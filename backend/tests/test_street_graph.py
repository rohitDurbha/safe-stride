from pathlib import Path

import pytest

import street_graph
from street_graph import DEFAULT_GRAPH_PATH, graph_path, load_street_graph


def quiet(_message):
    pass


def test_graph_path_defaults_to_the_backend_cache_folder():
    assert graph_path({}) == DEFAULT_GRAPH_PATH
    assert graph_path({"STREET_GRAPH_PATH": "  "}) == DEFAULT_GRAPH_PATH


def test_graph_path_reads_street_graph_path():
    assert graph_path({"STREET_GRAPH_PATH": "/data/g.graphml"}) == Path("/data/g.graphml")


def test_reads_the_cached_file_without_downloading(tmp_path):
    cached = tmp_path / "g.graphml"
    cached.write_text("<graphml/>")

    def no_download():
        raise AssertionError("should not download when the cache exists")

    graph, source = load_street_graph(
        cached, download=no_download, read=lambda p: ("graph from", p), log=quiet
    )
    assert source == "cache"
    assert graph == ("graph from", cached)


def test_downloads_and_saves_when_the_cache_is_missing(tmp_path):
    target = tmp_path / "nested" / "g.graphml"
    saved = []

    graph, source = load_street_graph(
        target,
        download=lambda: "fresh graph",
        save=lambda g, p: saved.append((g, p)),
        read=lambda p: pytest.fail("nothing to read yet"),
        log=quiet,
    )
    assert source == "download"
    assert graph == "fresh graph"
    assert saved == [("fresh graph", target)]


def test_a_failed_save_still_returns_the_downloaded_graph(tmp_path):
    def read_only(_graph, _path):
        raise PermissionError("read only file system")

    messages = []
    graph, source = load_street_graph(
        tmp_path / "g.graphml", download=lambda: "fresh graph", save=read_only, log=messages.append
    )
    assert (graph, source) == ("fresh graph", "download")
    assert any("Could not save" in m for m in messages)


def test_save_and_read_round_trip_a_real_graph(tmp_path):
    nx = pytest.importorskip("networkx")
    pytest.importorskip("osmnx")
    g = nx.MultiDiGraph(crs="epsg:4326")
    g.add_node(1, x=-122.27, y=37.80)
    g.add_node(2, x=-122.26, y=37.81)
    g.add_edge(1, 2, length=150.0, lit="yes", highway="footway", osmid=7)

    path = tmp_path / "cache" / "g.graphml"
    street_graph.save_graph(g, path)
    assert path.is_file()
    assert not path.with_name(path.name + ".tmp").exists()

    loaded, source = load_street_graph(path, download=lambda: pytest.fail("cached"), log=quiet)
    assert source == "cache"
    data = next(iter(loaded.edges(data=True)))[2]
    assert data["length"] == 150.0
    assert data["lit"] == "yes"
