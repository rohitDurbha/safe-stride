"""Incident classification for spoken safety reports, plus the graph update
that follows a new report.

The classifier asks Gemini, through the google-genai SDK, to score a
transcript against the known Oakland crime categories and return JSON that
matches a fixed schema. The model name comes from the GEMINI_MODEL setting.
"""
import json
import os

from shapely.geometry import Point
import geopandas as gpd

import config  # noqa: F401  (loads backend/.env before the settings are read)

DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite"
UNKNOWN = "UNKNOWN"

CRIME_CATEGORIES = (
    "FELONY ASSAULT", "PETTY THEFT", "BURG - RESIDENTIAL", "MISDEMEANOR ASSAULT", "ARSON",
    "BURG - AUTO", "DUI", "VANDALISM", "GRAND THEFT", "STOLEN VEHICLE", "WEAPONS", "FRAUD",
    "OTHER", "DISORDERLY CONDUCT", "BURG - COMMERCIAL", "FELONY WARRANT", "THREATS",
    "POSSESSION - STOLEN PROPERTY", "ROBBERY", "RECOVERED O/S STOLEN", "DOMESTIC VIOLENCE",
    "NARCOTICS", "KIDNAPPING", "FORGERY & COUNTERFEITING", "FORCIBLE RAPE", "HOMICIDE",
    "STOLEN AND RECOVERED VEHICLE", "CURFEW & LOITERING", "OTHER SEX OFFENSES", "BRANDISHING",
    "CHILD ABUSE", "BURG - OTHER", "MISCELLANEOUS TRAFFIC CRIME", "EMBEZZLEMENT",
    "RECOVERED VEHICLE - OAKLAND STOLEN", "GAMBLING", "PROSTITUTION",
    "ENVIRONMENTAL CRIME", "MISDEMEANOR WARRANT",
)

# JSON schema the model must follow. The enum keeps answers inside the
# category list, so the result can be used without any cleanup.
RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "matches": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "category": {"type": "string", "enum": list(CRIME_CATEGORIES)},
                    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                },
                "required": ["category", "confidence"],
            },
        },
    },
    "required": ["matches"],
}

PROMPT_TEMPLATE = """You classify spoken safety reports from people walking in Oakland.
Pick every crime category that fits the transcript below and give each one a
confidence between 0 and 1. Return an empty list if none of them fit.

Transcript:
{transcript}
"""

_client = None


def gemini_model():
    return os.getenv("GEMINI_MODEL", "").strip() or DEFAULT_GEMINI_MODEL


def _default_client():
    """Build the Gemini client once, or return None when no key is set."""
    global _client
    if _client is None:
        api_key = os.getenv("GOOGLE_API_KEY", "").strip()
        if not api_key:
            return None
        from google import genai

        _client = genai.Client(api_key=api_key)
    return _client


def parse_matches(payload):
    """Return the best category from the model's JSON reply, or UNKNOWN.

    Anything outside the category list or the 0 to 1 range is ignored, so a
    malformed reply can never put an unexpected label into the database.
    """
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except json.JSONDecodeError:
            return UNKNOWN
    if not isinstance(payload, dict):
        return UNKNOWN

    best, best_score = UNKNOWN, -1.0
    for match in payload.get("matches") or []:
        if not isinstance(match, dict):
            continue
        category = match.get("category")
        score = match.get("confidence")
        if category not in CRIME_CATEGORIES or isinstance(score, bool):
            continue
        if not isinstance(score, (int, float)) or not 0 <= score <= 1:
            continue
        if score > best_score:
            best, best_score = category, float(score)
    return best


def classify_incident(transcript: str, client=None) -> str:
    """Return the most likely crime category for a transcript.

    Returns UNKNOWN when the transcript is empty, no API key is configured,
    the Gemini call fails, or the reply does not name a known category.
    """
    if not transcript or not transcript.strip():
        return UNKNOWN

    client = client or _default_client()
    if client is None:
        print("GOOGLE_API_KEY is not set, so the report was not classified.")
        return UNKNOWN

    from google.genai import types

    try:
        response = client.models.generate_content(
            model=gemini_model(),
            contents=PROMPT_TEMPLATE.format(transcript=transcript.strip()),
            config=types.GenerateContentConfig(
                temperature=0,
                response_mime_type="application/json",
                response_json_schema=RESPONSE_SCHEMA,
            ),
        )
    except Exception as error:  # network errors, quota limits, bad keys
        print("Gemini classification failed:", error)
        return UNKNOWN

    return parse_matches(response.text or "")


def update_graph_with_report(crime_type, lat, lon, edges, G, severity_map, compute_safety_score):
    print("DEBUG: Updating graph for", crime_type, lat, lon)

    if edges.crs is None:
        print("DEBUG: edges had no CRS, setting to EPSG:3857")
        edges.set_crs("EPSG:3857", inplace=True)

    if edges.geometry.name != "geometry":
        edges = edges.set_geometry("geometry")

    try:
        pt = Point(lon, lat)
        pt_gdf = gpd.GeoDataFrame(geometry=[pt], crs="EPSG:4326")
        pt_gdf = pt_gdf.to_crs(edges.crs)
    except Exception as e:
        raise ValueError(f"Error transforming point to CRS: {e}")

    if pt_gdf.geometry.is_empty.any():
        raise ValueError("Transformed point geometry is empty")

    print("DEBUG: Transformed point geometry:", pt_gdf.geometry.iloc[0])
    print("DEBUG: Calculating distance from edges...")

    nearby = edges[edges.geometry.distance(pt_gdf.geometry.iloc[0]) < 30]
    print("DEBUG: Nearby edges found:", len(nearby))

    base_score = severity_map.get(crime_type, 0.4)
    learning_rate = 0.2

    for idx in nearby.index:
        current = edges.loc[idx, 'crime_score']
        bump = learning_rate * base_score
        edges.loc[idx, 'crime_score'] = min(current + bump, 1.0)

    edges['safety_score'] = edges.apply(compute_safety_score, axis=1)

    for u, v, k, data in G.edges(keys=True, data=True):
        try:
            row = edges.loc[(edges['u'] == u) & (edges['v'] == v)].iloc[0]
            data['weight'] = 1 - row['safety_score']
        except Exception as e:
            print(f"DEBUG: Failed to update edge ({u}, {v}, {k}): {e}")
            data['weight'] = 1

    # Create a copy of the dataframe to avoid modifying the original
    edges_to_save = edges.copy()
    
    def handle_list_value(x, col_name):
        if not isinstance(x, list):
            return x
            
        # Special handling for specific columns
        if col_name == 'osmid':
            return x[0] if len(x) > 0 else None
        elif col_name == 'reversed':
            return x[0] if len(x) > 0 else False
        elif col_name == 'highway':
            return x[0] if len(x) > 0 else None
        elif col_name == 'name':
            return x[0] if len(x) > 0 else None
        elif col_name == 'oneway':
            return x[0] if len(x) > 0 else False
        elif col_name == 'lanes':
            return x[0] if len(x) > 0 else None
        elif col_name == 'maxspeed':
            return x[0] if len(x) > 0 else None
        elif col_name == 'length':
            return x[0] if len(x) > 0 else None
        elif col_name == 'bridge':
            return x[0] if len(x) > 0 else False
        elif col_name == 'tunnel':
            return x[0] if len(x) > 0 else False
        elif col_name == 'access':
            return x[0] if len(x) > 0 else None
        elif col_name == 'service':
            return x[0] if len(x) > 0 else None
        elif col_name == 'junction':
            return x[0] if len(x) > 0 else None
        elif col_name == 'ref':
            return x[0] if len(x) > 0 else None
        elif col_name == 'surface':
            return x[0] if len(x) > 0 else None
        elif col_name == 'width':
            return x[0] if len(x) > 0 else None
        elif col_name == 'area':
            return x[0] if len(x) > 0 else False
        elif col_name == 'landuse':
            return x[0] if len(x) > 0 else None
        elif col_name == 'boundary':
            return x[0] if len(x) > 0 else None
        elif col_name == 'admin_level':
            return x[0] if len(x) > 0 else None
        elif col_name == 'natural':
            return x[0] if len(x) > 0 else None
        elif col_name == 'waterway':
            return x[0] if len(x) > 0 else None
        elif col_name == 'aerialway':
            return x[0] if len(x) > 0 else None
        elif col_name == 'barrier':
            return x[0] if len(x) > 0 else None
        elif col_name == 'man_made':
            return x[0] if len(x) > 0 else None
        elif col_name == 'z_order':
            return x[0] if len(x) > 0 else None
        elif col_name == 'other_tags':
            return str(x) if len(x) > 0 else None
        else:
            # For any other column, convert to string
            return str(x)

    # Apply the list handling function to all object-type columns
    for col in edges_to_save.columns:
        if edges_to_save[col].dtype == 'object':
            edges_to_save[col] = edges_to_save[col].apply(lambda x: handle_list_value(x, col))

    # Ensure geometry column is properly handled
    if 'geometry' in edges_to_save.columns:
        edges_to_save = edges_to_save.set_geometry('geometry')

    try:
        edges_to_save.to_parquet("edges_updated.parquet")
    except Exception as e:
        print(f"Error saving to parquet: {e}")
        # Fallback to saving without geometry
        edges_to_save.drop(columns=['geometry']).to_parquet("edges_updated.parquet")

    return len(nearby)
