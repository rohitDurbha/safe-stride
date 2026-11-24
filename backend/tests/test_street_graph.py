from pathlib import Path

import networkx as nx
import numpy as np
import pytest
from shapely.geometry import LineString

import street_graph
from routing import SafetyRouter, to_metric_xy
from street_graph import DEFAULT_GRAPH_PATH, StreetPack, graph_path, load_street_graph


def quiet(_message):
    pass


def test_graph_path_defaults_to_the_backend_cache_folder():
    assert graph_path({}) == DEFAULT_GRAPH_PATH
    assert graph_path({"STREET_GRAPH_PATH": "  "}) == DEFAULT_GRAPH_PATH


def test_graph_path_reads_street_graph_path():
    assert graph_path({"STREET_GRAPH_PATH": "/data/g.pkl.gz"}) == Path("/data/g.pkl.gz")


def test_reads_the_cached_file_without_downloading(tmp_path):
    cached = tmp_path / "g.pkl.gz"
    cached.write_bytes(b"x")

    def no_build():
        raise AssertionError("should not download when the cache exists")

    pack, source = load_street_graph(cached, build=no_build, read=lambda p: ("pack from", p), log=quiet)
    assert source == "cache"
    assert pack == ("pack from", cached)


def test_builds_and_saves_when_the_cache_is_missing(tmp_path):
    target = tmp_path / "nested" / "g.pkl.gz"
    saved = []

    pack, source = load_street_graph(
        target,
        build=lambda: "fresh pack",
        save=lambda g, p: saved.append((g, p)),
        read=lambda p: pytest.fail("nothing to read yet"),
        log=quiet,
    )
    assert (pack, source) == ("fresh pack", "download")
    assert saved == [("fresh pack", target)]


def test_a_failed_save_still_returns_the_built_pack(tmp_path):
    def read_only(_pack, _path):
        raise PermissionError("read only file system")

    messages = []
    pack, source = load_street_graph(
        tmp_path / "g.pkl.gz", build=lambda: "fresh pack", save=read_only, log=messages.append
    )
    assert (pack, source) == ("fresh pack", "download")
    assert any("Could not save" in m for m in messages)


# Three downtown Oakland intersections about 300 m apart.
NODES = {1: (-122.2712, 37.8044), 2: (-122.2680, 37.8060), 3: (-122.2650, 37.8080)}


def tiny_pack():
    g = nx.MultiDiGraph(crs="epsg:4326")
    for n, (lon, lat) in NODES.items():
        g.add_node(n, x=lon, y=lat)
    keys, geoms = [], []
    for u, v in [(1, 2), (2, 1), (2, 3), (3, 2)]:
        g.add_edge(u, v, 0, length=300.0, lit="yes")
        xs, ys = to_metric_xy([NODES[u][0], NODES[v][0]], [NODES[u][1], NODES[v][1]])
        keys.append((u, v, 0))
        geoms.append(LineString(zip(xs, ys)))
    ids = np.array(list(NODES))
    xs, ys = to_metric_xy([NODES[n][0] for n in ids], [NODES[n][1] for n in ids])
    return StreetPack(g, keys, np.asarray(geoms, dtype=object), ids, np.column_stack([xs, ys]))


def test_nearest_node_finds_the_closest_intersection():
    pack = tiny_pack()
    assert pack.nearest_node(-122.2711, 37.8045) == 1
    assert pack.nearest_node(-122.2652, 37.8079) == 3
    assert isinstance(pack.nearest_node(-122.2680, 37.8060), int)


def test_save_and_read_round_trip_feeds_the_router(tmp_path):
    path = tmp_path / "cache" / "g.pkl.gz"
    street_graph.save_pack(tiny_pack(), path)
    assert path.is_file()
    assert not path.with_name(path.name + ".tmp").exists()

    pack, source = load_street_graph(path, build=lambda: pytest.fail("cached"), log=quiet)
    assert source == "cache"
    result = SafetyRouter.from_pack(pack).route(1, 3)
    assert result.nodes == [1, 2, 3]
    assert result.distance_m == pytest.approx(600)


def test_reading_a_pack_from_another_version_asks_for_a_rebuild(tmp_path, monkeypatch):
    path = tmp_path / "g.pkl.gz"
    street_graph.save_pack(tiny_pack(), path)
    monkeypatch.setattr(street_graph, "PACK_VERSION", 99)
    with pytest.raises(ValueError, match="rebuild"):
        street_graph.read_pack(path)


def test_pack_graph_keeps_only_what_routing_needs():
    pytest.importorskip("osmnx")
    g = nx.MultiDiGraph(crs="epsg:4326")
    for n, (lon, lat) in NODES.items():
        g.add_node(n, x=lon, y=lat, street_count=3, highway="crossing")
    g.add_edge(1, 2, 0, length=300.0, lit="no", osmid=7, name="Broadway", highway="footway")
    g.add_edge(2, 3, 0, length=300.0, osmid=8, geometry=LineString([NODES[2], NODES[3]]))

    pack = street_graph.pack_graph(g)

    assert set(pack.graph.edges[1, 2, 0]) == {"length", "lit"}
    assert set(pack.graph.edges[2, 3, 0]) == {"length", "geometry"}
    assert set(pack.graph.nodes[1]) == {"x", "y"}
    assert sorted(pack.edge_keys) == [(1, 2, 0), (2, 3, 0)]
    # Shapes are in metres, so a 300 m street is roughly 300 long.
    lengths = sorted(geom.length for geom in pack.metric_geoms)
    assert 250 < lengths[0] < 450
    assert pack.nearest_node(-122.2712, 37.8044) == 1


class FakeOx:
    def __init__(self, failing):
        self.failing = failing
        self.settings = type("Settings", (), {"overpass_url": None})()
        self.tried = []

    def graph_from_place(self, place, network_type):
        url = self.settings.overpass_url
        self.tried.append(url)
        if url in self.failing:
            raise ConnectionError(f"{url} refused")
        return f"graph from {url}"


def test_download_falls_back_to_the_next_overpass_server():
    ox = FakeOx(failing={"https://a"})
    graph = street_graph.download_graph(urls=("https://a", "https://b"), ox=ox, log=quiet)
    assert graph == "graph from https://b"
    assert ox.tried == ["https://a", "https://b"]


def test_download_reports_every_server_when_all_fail():
    ox = FakeOx(failing={"https://a", "https://b"})
    with pytest.raises(RuntimeError, match="https://a.*\n.*https://b"):
        street_graph.download_graph(urls=("https://a", "https://b"), ox=ox, log=quiet)
