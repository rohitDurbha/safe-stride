"""Load the Oakland walking graph from a local file instead of OpenStreetMap.

Downloading the graph from OpenStreetMap takes minutes and depends on the
Overpass API being up, so the server reads a GraphML file saved ahead of
time. The Docker image builds that file once with

    python street_graph.py

and a local checkout builds it the first time the server starts.
"""
import os
import sys
from pathlib import Path

GRAPH_PLACE = "Oakland, California, USA"
NETWORK_TYPE = "walk"
DEFAULT_GRAPH_PATH = Path(__file__).resolve().parent / "cache" / "oakland_walk.graphml"


def graph_path(environ=None):
    """Return where the cached graph lives, from STREET_GRAPH_PATH if set."""
    environ = os.environ if environ is None else environ
    raw = environ.get("STREET_GRAPH_PATH", "").strip()
    return Path(raw) if raw else DEFAULT_GRAPH_PATH


def _osmnx():
    import osmnx as ox

    # Keep the OSM "lit" tag on streets so night routes can prefer lit streets.
    ox.settings.useful_tags_way = sorted(set(ox.settings.useful_tags_way) | {"lit"})
    return ox


def download_graph(place=GRAPH_PLACE):
    ox = _osmnx()
    return ox.graph_from_place(place, network_type=NETWORK_TYPE)


def save_graph(graph, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    # Write to a temporary name first so an interrupted build never leaves a
    # half written file that the next start would try to read.
    tmp = path.with_name(path.name + ".tmp")
    _osmnx().save_graphml(graph, tmp)
    os.replace(tmp, path)


def read_graph(path):
    return _osmnx().load_graphml(path)


def load_street_graph(path=None, download=download_graph, save=save_graph, read=read_graph, log=print):
    """Read the cached graph, or download and cache it when the file is missing.

    Returns ``(graph, source)`` where ``source`` is ``"cache"`` or ``"download"``.
    """
    path = Path(path) if path is not None else graph_path()
    if path.is_file():
        log(f"Loading street graph from {path}")
        return read(path), "cache"
    log(f"No street graph at {path}, downloading {GRAPH_PLACE} from OpenStreetMap")
    graph = download()
    try:
        save(graph, path)
        log(f"Saved street graph to {path}")
    except OSError as exc:
        # A read only disk should not stop the server, it only costs the
        # next start another download.
        log(f"Could not save street graph to {path}: {exc}")
    return graph, "download"


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    path = Path(argv[0]) if argv else graph_path()
    graph = download_graph()
    save_graph(graph, path)
    print(f"Saved {graph.number_of_nodes()} nodes and {graph.number_of_edges()} edges to {path}")


if __name__ == "__main__":
    main()
