"""Build the GeoJSON points behind the heatmap.

Crime records imported from crime_rate.csv can have empty cells, which
MongoDB may hold as NaN or leave out entirely. A NaN Location used to crash
the /heatmap_data route, and a NaN crime type was sent to the browser as a
bare NaN, which is not valid JSON. Either one left the heatmap empty, so
every value is checked here before it reaches the response.
"""
import math
import re

POINT_PATTERN = re.compile(r"POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)")

CRIME_INTENSITY = 0.7
REPORT_INTENSITY = 0.9
UNKNOWN_TYPE = "UNKNOWN"


def _number(value):
    """Return value as a finite float, or None."""
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _valid_coordinates(lon, lat):
    if lon is None or lat is None:
        return False
    # (0, 0) is what a report without a location used to fall back to.
    if lon == 0 and lat == 0:
        return False
    return -180 <= lon <= 180 and -90 <= lat <= 90


def _label(value):
    if isinstance(value, str) and value.strip():
        return value.strip()
    return UNKNOWN_TYPE


def _feature(lon, lat, label, intensity):
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": {"type": label, "intensity": intensity},
    }


def parse_point(location):
    """Turn a 'POINT (lon lat)' string into (lon, lat), or None."""
    if not isinstance(location, str):
        return None
    match = POINT_PATTERN.search(location)
    if not match:
        return None
    lon, lat = _number(match.group(1)), _number(match.group(2))
    return (lon, lat) if _valid_coordinates(lon, lat) else None


def crime_features(crimes):
    features = []
    for crime in crimes:
        point = parse_point(crime.get("Location"))
        if point is None:
            continue
        features.append(_feature(point[0], point[1], _label(crime.get("CRIMETYPE")), CRIME_INTENSITY))
    return features


def report_features(reports):
    features = []
    for report in reports:
        location = report.get("location")
        if not isinstance(location, dict):
            continue
        lon, lat = _number(location.get("lon")), _number(location.get("lat"))
        if not _valid_coordinates(lon, lat):
            continue
        features.append(_feature(lon, lat, _label(report.get("incident_type")), REPORT_INTENSITY))
    return features


def heatmap_points(crimes, reports):
    return crime_features(crimes) + report_features(reports)
