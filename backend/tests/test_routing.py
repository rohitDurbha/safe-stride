from datetime import datetime

import networkx as nx
import pytest
from shapely.geometry import LineString, Point

import routing as R

NOW = datetime(2026, 11, 8, 12, 0)
NIGHT_TIME = datetime(2026, 11, 1, 23, 0)
DAY_TIME = datetime(2026, 11, 1, 13, 0)


def build_router(lit=None):
    """Two ways from A to B in a local metric grid.

    Direct: A (0,0) -> M (500,0) -> B (1000,0), 1000 m.
    Around: A -> P (0,200) -> Q (1000,200) -> B, 1400 m.
    Node x/y are used as lon/lat, which is fine for these tests.
    """
    coords = {"A": (0, 0), "M": (500, 0), "B": (1000, 0), "P": (0, 200), "Q": (1000, 200)}
    G = nx.MultiDiGraph()
    for name, (x, y) in coords.items():
        G.add_node(name, x=x, y=y)
    keys, geoms = [], []
    for a, b in [("A", "M"), ("M", "B"), ("A", "P"), ("P", "Q"), ("Q", "B")]:
        for u, v in [(a, b), (b, a)]:
            line = LineString([coords[u], coords[v]])
            data = {"length": line.length, "geometry": line}
            if lit and (a, b) in lit:
                data["lit"] = lit[(a, b)]
            G.add_edge(u, v, 0, **data)
            keys.append((u, v, 0))
            geoms.append(line)
    return R.SafetyRouter(G, keys, geoms, now=NOW)


def add_hotspot(router, x, y, crime="ROBBERY", count=5, when=NIGHT_TIME):
    points = [Point(x, y)] * count
    return router.add_crimes(points, [crime] * count, [when] * count)


def test_without_crime_the_route_is_the_shortest_path():
    result = build_router().route("A", "B")
    assert result.nodes == ["A", "M", "B"]
    assert result.distance_m == pytest.approx(1000)


def test_route_walks_around_a_hotspot():
    router = build_router()
    add_hotspot(router, 500, 0)

    result = router.route("A", "B", night=True)

    assert result.nodes == ["A", "P", "Q", "B"]
    assert result.exposure < result.shortest_exposure
    assert result.summary()["exposure_reduction"] == 1.0


def test_detour_cap_keeps_routes_reasonable():
    router = build_router()
    add_hotspot(router, 500, 0)

    result = router.route("A", "B", night=True, max_detour=1.2)

    assert result.nodes == ["A", "M", "B"]
    assert result.distance_m <= 1.2 * result.shortest_distance_m


def test_minor_crimes_do_not_cause_long_detours():
    router = build_router()
    add_hotspot(router, 500, 0, crime="STOLEN VEHICLE", count=1, when=DAY_TIME)
    assert router.route("A", "B", night=False).nodes == ["A", "M", "B"]


def test_crime_spreads_to_nearby_streets_but_not_far_ones():
    router = build_router()
    add_hotspot(router, 500, 100)  # 100 m from both east-west streets
    g = router.graph
    assert g.edges["A", "M", 0]["hot_night"] > 0
    assert g.edges["P", "Q", 0]["hot_night"] > 0
    assert g.edges["M", "A", 0]["hot_night"] > 0  # both directions of a street
    assert g.edges["Q", "B", 0]["hot_night"] == 0  # 500 m away


def test_kernel_radius_cuts_off_far_crimes():
    router = build_router()
    add_hotspot(router, 500, 70)  # 70 m from the direct street, 130 m from P-Q
    g = router.graph
    assert g.edges["A", "M", 0]["hot_night"] > 0
    assert g.edges["P", "Q", 0]["hot_night"] == 0


def test_night_crimes_weigh_more_at_night():
    day_w, night_w = R.crime_weights(["ROBBERY"], [NIGHT_TIME], NOW)
    assert night_w[0] > day_w[0]
    day_w, night_w = R.crime_weights(["ROBBERY"], [DAY_TIME], NOW)
    assert day_w[0] > night_w[0]


def test_severity_and_recency():
    assert R.severity("ROBBERY") > R.severity("BURG - AUTO") > R.severity("FRAUD")
    assert R.severity(None) == R.DEFAULT_SEVERITY
    fresh = R.recency_weight(NOW, NOW)
    half = R.recency_weight(datetime(2026, 8, 10, 12, 0), NOW)
    old = R.recency_weight(datetime(2020, 1, 1), NOW)
    assert fresh == pytest.approx(1.0)
    assert half == pytest.approx(R.RECENCY_FLOOR + (1 - R.RECENCY_FLOOR) / 2)
    assert old == pytest.approx(R.RECENCY_FLOOR, abs=1e-3)


def test_unlit_streets_are_avoided_only_at_night():
    # Make the detour only slightly longer than the direct way, but unlit
    # on the direct way. Day routes ignore lighting.
    router = build_router(lit={("A", "M"): "no", ("M", "B"): "no", ("A", "P"): "yes", ("P", "Q"): "yes", ("Q", "B"): "yes"})
    assert router.route("A", "B", night=False).nodes == ["A", "M", "B"]
    assert router.route("A", "B", night=True, max_detour=2).nodes == ["A", "P", "Q", "B"]


@pytest.mark.parametrize(
    "tag, expected",
    [("yes", 0.0), ("no", R.UNLIT_PENALTY), (None, R.UNKNOWN_LIGHTING_PENALTY), (["yes", "no"], R.UNLIT_PENALTY), ("24/7", 0.0)],
)
def test_darkness_from_lit_tag(tag, expected):
    assert R.darkness(tag) == expected


def test_route_coordinates_follow_the_direction_of_travel():
    router = build_router()
    # Store the A-M geometry backwards, as OSM sometimes does.
    router.graph.edges["A", "M", 0]["geometry"] = LineString([(500, 0), (0, 0)])
    coords = router.route("A", "B").coords
    assert coords[0] == [0, 0]
    assert coords[-1] == [0, 1000]


def test_records_from_mongo_include_saved_reports():
    crimes = [
        {"CRIMETYPE": "ROBBERY", "Location": "POINT (-122.27 37.80)", "DATETIME": "01/20/2025 11:05:00 PM"},
        {"CRIMETYPE": "ROBBERY", "Location": float("nan")},
    ]
    reports = [
        {"incident_type": "THREATS", "location": {"lat": 37.81, "lon": -122.26}, "timestamp": datetime(2026, 11, 8, 6, 0)},
        {"incident_type": "THREATS", "location": {}},
    ]
    lons, lats, types, times = R.crimes_from_records(crimes, reports)
    assert lons == [-122.27, -122.26]
    assert types == ["ROBBERY", "THREATS"]
    assert times[0] == datetime(2025, 1, 20, 23, 5)
    # 06:00 UTC is 22:00 the previous evening in Oakland
    assert times[1] == datetime(2026, 11, 7, 22, 0)
