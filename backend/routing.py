"""Safety-aware walking routes for SafeStride.

How a route is chosen
---------------------
Every street segment (graph edge) gets a crime exposure score. Each crime
spreads its weight over nearby streets with a Gaussian falloff, so a street
right next to a cluster of incidents scores high and the next block over
scores a little. Before this module, a crime only counted if it sat inside
a 25 m buffer, so one block away from a hotspot looked perfectly safe.

A crime's weight is the product of three things.

* Severity for someone on foot. Robbery and assault count far more than
  car break-ins, fraud or a stolen vehicle.
* Recency. Older incidents fade with a 90 day half-life but never drop
  below a floor, so the historic dataset still matters.
* Time of day. Crimes that happened in the same period as the walk (day or
  night) count fully and the others count partly, so night routes avoid
  places that are dangerous at night.

The cost of walking an edge is

    cost = length * (1 + darkness_penalty) + safety_weight * hot

where ``hot = log1p(exposure)``. The log keeps one very busy downtown block
from swamping everything else, and ``safety_weight`` is in metres, so it
reads as "how far out of the way to walk to avoid one unit of danger".
At night, streets OpenStreetMap tags as unlit cost extra, and untagged
streets cost a little extra.

Finally, the route is never allowed to wander more than ``max_detour``
times the length of the plain shortest path. If the safest route is longer
than that, the safety weight is halved until the route fits, so people get
the safest route that is still a reasonable walk.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
import math
from zoneinfo import ZoneInfo

import networkx as nx
import numpy as np
import shapely
from shapely.geometry import LineString

METRIC_CRS = "EPSG:32610"  # UTM zone 10N, metres, covers the Bay Area
LOCAL_TZ = ZoneInfo("America/Los_Angeles")

KERNEL_SIGMA_M = 40.0
KERNEL_RADIUS_M = 120.0

HALF_LIFE_DAYS = 90.0
RECENCY_FLOOR = 0.35

SAME_PERIOD_WEIGHT = 1.0
OTHER_PERIOD_WEIGHT = 0.4
NIGHT_START_HOUR = 19
NIGHT_END_HOUR = 6

DEFAULT_SAFETY_WEIGHT_M = 300.0
DEFAULT_MAX_DETOUR = 1.5
MIN_SAFETY_WEIGHT_M = 10.0

UNLIT_PENALTY = 0.5
UNKNOWN_LIGHTING_PENALTY = 0.1

# How dangerous each category is for a pedestrian, from 0 to 1.
DEFAULT_SEVERITY = 0.3
SEVERITY = {
    "HOMICIDE": 1.0,
    "FORCIBLE RAPE": 1.0,
    "KIDNAPPING": 0.95,
    "FELONY ASSAULT": 0.9,
    "ROBBERY": 0.9,
    "WEAPONS": 0.8,
    "BRANDISHING": 0.8,
    "OTHER SEX OFFENSES": 0.75,
    "ARSON": 0.6,
    "THREATS": 0.6,
    "MISDEMEANOR ASSAULT": 0.6,
    "CHILD ABUSE": 0.5,
    "DOMESTIC VIOLENCE": 0.4,
    "GRAND THEFT": 0.4,
    "PETTY THEFT": 0.35,
    "DISORDERLY CONDUCT": 0.35,
    "NARCOTICS": 0.35,
    "BURG - RESIDENTIAL": 0.3,
    "PROSTITUTION": 0.25,
    "CURFEW & LOITERING": 0.25,
    "VANDALISM": 0.25,
    "BURG - COMMERCIAL": 0.2,
    "BURG - OTHER": 0.2,
    "BURG - AUTO": 0.15,
    "DUI": 0.15,
    "STOLEN VEHICLE": 0.1,
    "STOLEN AND RECOVERED VEHICLE": 0.1,
    "RECOVERED VEHICLE - OAKLAND STOLEN": 0.05,
    "RECOVERED O/S STOLEN": 0.05,
    "POSSESSION - STOLEN PROPERTY": 0.1,
    "MISCELLANEOUS TRAFFIC CRIME": 0.1,
    "FELONY WARRANT": 0.1,
    "MISDEMEANOR WARRANT": 0.05,
    "FRAUD": 0.05,
    "FORGERY & COUNTERFEITING": 0.05,
    "EMBEZZLEMENT": 0.05,
    "GAMBLING": 0.05,
    "ENVIRONMENTAL CRIME": 0.05,
}


def severity(crime_type):
    if isinstance(crime_type, str):
        return SEVERITY.get(crime_type.strip().upper(), DEFAULT_SEVERITY)
    return DEFAULT_SEVERITY


def is_night(hour):
    return hour >= NIGHT_START_HOUR or hour < NIGHT_END_HOUR


def recency_weight(when, now):
    """Weight between RECENCY_FLOOR and 1 that halves every HALF_LIFE_DAYS."""
    if when is None:
        return RECENCY_FLOOR
    age_days = max((now - when).total_seconds() / 86400.0, 0.0)
    return RECENCY_FLOOR + (1 - RECENCY_FLOOR) * 0.5 ** (age_days / HALF_LIFE_DAYS)


def crime_weights(crime_types, times, now):
    """Return (day_weights, night_weights) arrays for a list of crimes."""
    day, night = [], []
    for crime_type, when in zip(crime_types, times):
        base = severity(crime_type) * recency_weight(when, now)
        if when is None:
            # Time unknown, so count it as if it could be either period.
            day.append(base * (SAME_PERIOD_WEIGHT + OTHER_PERIOD_WEIGHT) / 2)
            night.append(day[-1])
        elif is_night(when.hour):
            day.append(base * OTHER_PERIOD_WEIGHT)
            night.append(base * SAME_PERIOD_WEIGHT)
        else:
            day.append(base * SAME_PERIOD_WEIGHT)
            night.append(base * OTHER_PERIOD_WEIGHT)
    return np.asarray(day, dtype=float), np.asarray(night, dtype=float)


def kernel_pairs(edge_geoms, points):
    """Find every (point, edge) pair within range and its kernel value.

    Uses one spatial index query, so it costs about the same for ten crimes
    or ten thousand instead of scanning the edge table per crime.
    """
    edge_geoms = np.asarray(edge_geoms, dtype=object)
    points = np.asarray(points, dtype=object)
    if len(edge_geoms) == 0 or len(points) == 0:
        empty = np.array([], dtype=int)
        return empty, empty, np.array([], dtype=float)
    tree = shapely.STRtree(edge_geoms)
    point_idx, edge_idx = tree.query(points, predicate="dwithin", distance=KERNEL_RADIUS_M)
    distance = shapely.distance(points[point_idx], edge_geoms[edge_idx])
    kernel = np.exp(-0.5 * (distance / KERNEL_SIGMA_M) ** 2)
    return point_idx, edge_idx, kernel


def exposure(edge_geoms, points, day_weights, night_weights):
    """Sum each crime's kernel-weighted contribution onto every edge."""
    day = np.zeros(len(edge_geoms))
    night = np.zeros(len(edge_geoms))
    point_idx, edge_idx, kernel = kernel_pairs(edge_geoms, points)
    np.add.at(day, edge_idx, np.asarray(day_weights)[point_idx] * kernel)
    np.add.at(night, edge_idx, np.asarray(night_weights)[point_idx] * kernel)
    return day, night


def darkness(lit):
    """Night penalty from the OSM lit tag (a string, a list of them, or None)."""
    values = lit if isinstance(lit, list) else [lit]
    values = [str(v).strip().lower() for v in values if isinstance(v, str)]
    if not values:
        return UNKNOWN_LIGHTING_PENALTY
    if any(v in ("no", "disused") for v in values):
        return UNLIT_PENALTY
    if any(v in ("yes", "24/7", "automatic", "limited", "interval", "sunset-sunrise", "dusk-dawn") for v in values):
        return 0.0
    return UNKNOWN_LIGHTING_PENALTY


def parse_crime_time(value):
    """Parse the DATETIME column ('01/20/2025 05:05:00 PM'), or None."""
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        return None
    for fmt in ("%m/%d/%Y %I:%M:%S %p", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(value.strip(), fmt)
        except ValueError:
            continue
    return None


def local_now():
    """Current Oakland wall-clock time as a naive datetime, like the dataset."""
    return datetime.now(LOCAL_TZ).replace(tzinfo=None)


def utc_to_local(when):
    """Reports are stored with datetime.utcnow(), so shift them to local time."""
    if not isinstance(when, datetime):
        return None
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    return when.astimezone(LOCAL_TZ).replace(tzinfo=None)


def crimes_from_records(crime_docs, report_docs):
    """Turn MongoDB crime and report documents into (lons, lats, types, times).

    Records without a usable location are skipped.
    """
    from heatmap import parse_point, _number, _valid_coordinates

    lons, lats, types, times = [], [], [], []
    for doc in crime_docs:
        point = parse_point(doc.get("Location"))
        if point is None:
            continue
        lons.append(point[0])
        lats.append(point[1])
        types.append(doc.get("CRIMETYPE"))
        times.append(parse_crime_time(doc.get("DATETIME")))
    for doc in report_docs:
        location = doc.get("location")
        if not isinstance(location, dict):
            continue
        lon, lat = _number(location.get("lon")), _number(location.get("lat"))
        if not _valid_coordinates(lon, lat):
            continue
        lons.append(lon)
        lats.append(lat)
        types.append(doc.get("incident_type"))
        times.append(utc_to_local(doc.get("timestamp")))
    return lons, lats, types, times


def to_metric_points(lons, lats):
    import geopandas as gpd

    if not lons:
        return np.array([], dtype=object)
    return gpd.GeoSeries(gpd.points_from_xy(lons, lats), crs="EPSG:4326").to_crs(METRIC_CRS).values


@dataclass
class RouteResult:
    nodes: list
    coords: list  # [[lat, lon], ...]
    distance_m: float
    shortest_distance_m: float
    exposure: float
    shortest_exposure: float
    night: bool
    safety_weight: float

    def summary(self):
        reduction = 0.0
        if self.shortest_exposure > 0:
            reduction = max(0.0, 1 - self.exposure / self.shortest_exposure)
        return {
            "distance_m": round(self.distance_m),
            "shortest_distance_m": round(self.shortest_distance_m),
            "detour_ratio": round(self.distance_m / self.shortest_distance_m, 2)
            if self.shortest_distance_m
            else 1.0,
            "crime_exposure": round(self.exposure, 2),
            "shortest_crime_exposure": round(self.shortest_exposure, 2),
            "exposure_reduction": round(reduction, 2),
            "period": "night" if self.night else "day",
            "safety_weight_m": round(self.safety_weight),
        }


class SafetyRouter:
    """Holds the street graph with per-edge risk attributes and finds routes.

    ``graph`` is an osmnx MultiDiGraph in WGS84 (node x is lon, y is lat) and
    ``edge_geoms`` holds each edge's geometry in METRIC_CRS, keyed by
    (u, v, key). Edge attributes written here: hot_day, hot_night, dark.
    """

    def __init__(self, graph, edge_keys, metric_geoms, now=None):
        self.graph = graph
        self.edge_keys = list(edge_keys)
        self.metric_geoms = np.asarray(metric_geoms, dtype=object)
        self.raw_day = np.zeros(len(self.edge_keys))
        self.raw_night = np.zeros(len(self.edge_keys))
        self.now = now
        for (u, v, k) in self.edge_keys:
            data = graph.edges[u, v, k]
            data["dark"] = darkness(data.get("lit"))
            data["hot_day"] = 0.0
            data["hot_night"] = 0.0
            data.setdefault("length", 0.0)

    @classmethod
    def from_osmnx(cls, graph, now=None):
        import osmnx as ox

        edges = ox.graph_to_gdfs(graph, nodes=False).to_crs(METRIC_CRS)
        return cls(graph, edges.index.tolist(), edges.geometry.values, now=now)

    def _now(self):
        return self.now or local_now()

    def add_records(self, lons, lats, crime_types, times):
        """Add crimes given as WGS84 lon/lat lists."""
        return self.add_crimes(to_metric_points(lons, lats), crime_types, times)

    def add_crimes(self, points_metric, crime_types, times):
        """Add crimes (points already in METRIC_CRS) and refresh edge risk."""
        day_w, night_w = crime_weights(crime_types, times, self._now())
        point_idx, edge_idx, kernel = kernel_pairs(self.metric_geoms, points_metric)
        np.add.at(self.raw_day, edge_idx, day_w[point_idx] * kernel)
        np.add.at(self.raw_night, edge_idx, night_w[point_idx] * kernel)
        for i in np.unique(edge_idx):
            data = self.graph.edges[self.edge_keys[i]]
            data["hot_day"] = math.log1p(self.raw_day[i])
            data["hot_night"] = math.log1p(self.raw_night[i])
        return len(np.unique(edge_idx))

    @staticmethod
    def _cost_fn(safety_weight, night):
        hot_attr = "hot_night" if night else "hot_day"

        def edge_cost(data):
            dark = data.get("dark", 0.0) if night else 0.0
            return data.get("length", 0.0) * (1 + dark) + safety_weight * data.get(hot_attr, 0.0)

        def cost(u, v, parallel):
            return min(edge_cost(d) for d in parallel.values())

        return cost, edge_cost

    def _path(self, orig, dest, safety_weight, night):
        cost, _ = self._cost_fn(safety_weight, night)
        return nx.shortest_path(self.graph, orig, dest, weight=cost)

    def _walk(self, path, safety_weight, night):
        """Pick the edge used between each node pair and total it up."""
        _, edge_cost = self._cost_fn(safety_weight, night)
        hot_attr = "hot_night" if night else "hot_day"
        coords, distance, risk = [], 0.0, 0.0
        for u, v in zip(path[:-1], path[1:]):
            data = min(self.graph.get_edge_data(u, v).values(), key=edge_cost)
            distance += data.get("length", 0.0)
            risk += data.get(hot_attr, 0.0)
            coords.extend(self._edge_coords(u, v, data))
        return coords, distance, risk

    def _edge_coords(self, u, v, data):
        nu, nv = self.graph.nodes[u], self.graph.nodes[v]
        geom = data.get("geometry")
        pts = list(geom.coords) if isinstance(geom, LineString) else [(nu["x"], nu["y"]), (nv["x"], nv["y"])]
        # Make sure the line runs from u to v so the polyline has no jumps.
        start, end = pts[0], pts[-1]
        if (start[0] - nu["x"]) ** 2 + (start[1] - nu["y"]) ** 2 > (end[0] - nu["x"]) ** 2 + (end[1] - nu["y"]) ** 2:
            pts.reverse()
        return [[lat, lon] for lon, lat in pts]

    def route(self, orig, dest, night=False, safety_weight=DEFAULT_SAFETY_WEIGHT_M, max_detour=DEFAULT_MAX_DETOUR):
        shortest = self._path(orig, dest, 0.0, night=False)
        _, shortest_len, _ = self._walk(shortest, 0.0, False)
        _, _, shortest_risk = self._walk(shortest, safety_weight, night)

        weight = safety_weight
        while True:
            path = self._path(orig, dest, weight, night)
            coords, distance, risk = self._walk(path, weight, night)
            if distance <= max_detour * shortest_len or weight <= MIN_SAFETY_WEIGHT_M:
                break
            weight /= 2

        if distance > max_detour * shortest_len:
            # Even a small safety weight wanders too far, so take the shortest path.
            path, weight = shortest, 0.0
            coords, distance, risk = self._walk(path, 0.0, night)

        return RouteResult(path, coords, distance, shortest_len, risk, shortest_risk, night, weight)
