"""Load the Oakland walking graph from a small prebuilt file.

Downloading the graph from OpenStreetMap takes minutes and needs osmnx,
geopandas and their large native libraries. The deploy workflow builds the
graph once with

    python street_graph.py

and saves a gzipped pickle that holds only what routing needs: the street
graph with lengths, lighting and shapes, each street's shape in metres, and
the node positions in metres for nearest-node lookups. Reading that file
needs only networkx, numpy, shapely and pyproj, which keeps the hosted
function small. A local checkout builds the file the first time the server
starts.
"""
import gzip
import os
import pickle
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np

GRAPH_PLACE = "Oakland, California, USA"
NETWORK_TYPE = "walk"
DEFAULT_GRAPH_PATH = Path(__file__).resolve().parent / "cache" / "oakland_walk.pkl.gz"
PACK_VERSION = 1

# Edge attributes routing reads. Everything else osmnx attaches is dropped.
EDGE_ATTRS = ("length", "lit", "geometry")


@dataclass
class StreetPack:
    """Everything the router needs, without osmnx or geopandas."""

    graph: object  # networkx MultiDiGraph, node x is lon and y is lat
    edge_keys: list  # (u, v, key) for each edge, in the order of metric_geoms
    metric_geoms: np.ndarray  # shapely geometries in routing.METRIC_CRS
    node_ids: np.ndarray
    node_xy: np.ndarray  # node positions in metres, shape (n, 2)

    def nearest_node(self, lon, lat):
        """Return the graph node closest to a WGS84 point."""
        from routing import to_metric_xy

        x, y = to_metric_xy([lon], [lat])
        d2 = (self.node_xy[:, 0] - x[0]) ** 2 + (self.node_xy[:, 1] - y[0]) ** 2
        return self.node_ids[int(np.argmin(d2))].item()


def graph_path(environ=None):
    """Return where the packed graph lives, from STREET_GRAPH_PATH if set."""
    environ = os.environ if environ is None else environ
    raw = environ.get("STREET_GRAPH_PATH", "").strip()
    return Path(raw) if raw else DEFAULT_GRAPH_PATH


def _osmnx():
    import osmnx as ox

    # Keep the OSM "lit" tag on streets so night routes can prefer lit streets.
    ox.settings.useful_tags_way = sorted(set(ox.settings.useful_tags_way) | {"lit"})
    # osmnx would otherwise save every raw Overpass reply under ./cache, which
    # is the folder the deploy uploads with the function.
    ox.settings.use_cache = False
    return ox


# Public Overpass servers, tried in order. The main one sometimes refuses
# connections from cloud runners, and the mirrors serve the same data.
OVERPASS_URLS = (
    "https://overpass-api.de/api",
    "https://overpass.private.coffee/api",
    "https://overpass.kumi.systems/api",
    "https://maps.mail.ru/osm/tools/overpass/api",
)


def download_graph(place=GRAPH_PLACE, urls=OVERPASS_URLS, ox=None, log=print):
    ox = ox or _osmnx()
    errors = []
    for url in urls:
        ox.settings.overpass_url = url
        try:
            return ox.graph_from_place(place, network_type=NETWORK_TYPE)
        except Exception as exc:  # network errors differ between servers
            log(f"Overpass server {url} failed: {exc}")
            errors.append(f"{url}: {exc}")
    raise RuntimeError("Every Overpass server failed:\n" + "\n".join(errors))


def pack_graph(graph):
    """Turn an osmnx graph into a StreetPack. Needs osmnx and geopandas."""
    import networkx as nx

    from routing import METRIC_CRS, to_metric_xy

    ox = _osmnx()
    edges = ox.graph_to_gdfs(graph, nodes=False).to_crs(METRIC_CRS)

    slim = nx.MultiDiGraph(crs="epsg:4326")
    for node, data in graph.nodes(data=True):
        slim.add_node(node, x=float(data["x"]), y=float(data["y"]))
    for u, v, k, data in graph.edges(keys=True, data=True):
        slim.add_edge(u, v, k, **{a: data[a] for a in EDGE_ATTRS if a in data})

    node_ids = np.array(list(slim.nodes))
    xs, ys = to_metric_xy(
        [slim.nodes[n]["x"] for n in node_ids], [slim.nodes[n]["y"] for n in node_ids]
    )
    return StreetPack(
        graph=slim,
        edge_keys=[tuple(key) for key in edges.index.tolist()],
        metric_geoms=np.asarray(edges.geometry.values, dtype=object),
        node_ids=node_ids,
        node_xy=np.column_stack([xs, ys]),
    )


def save_pack(pack, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    # Write to a temporary name first so an interrupted build never leaves a
    # half written file that the next start would try to read.
    tmp = path.with_name(path.name + ".tmp")
    with gzip.open(tmp, "wb", compresslevel=6) as fh:
        pickle.dump({"version": PACK_VERSION, "pack": pack}, fh, protocol=pickle.HIGHEST_PROTOCOL)
    os.replace(tmp, path)


def read_pack(path):
    # The file is built by our own deploy workflow, never uploaded by users.
    with gzip.open(path, "rb") as fh:
        payload = pickle.load(fh)
    if payload.get("version") != PACK_VERSION:
        raise ValueError(f"{path} was built by an older version, rebuild it with python street_graph.py")
    return payload["pack"]


def build_pack():
    return pack_graph(download_graph())


def load_street_graph(path=None, build=build_pack, save=save_pack, read=read_pack, log=print):
    """Read the packed graph, or build and save it when the file is missing.

    Returns ``(pack, source)`` where ``source`` is ``"cache"`` or ``"download"``.
    """
    path = Path(path) if path is not None else graph_path()
    if path.is_file():
        log(f"Loading street graph from {path}")
        return read(path), "cache"
    log(f"No street graph at {path}, downloading {GRAPH_PLACE} from OpenStreetMap")
    pack = build()
    try:
        save(pack, path)
        log(f"Saved street graph to {path}")
    except OSError as exc:
        # A read only disk should not stop the server, it only costs the
        # next start another download.
        log(f"Could not save street graph to {path}: {exc}")
    return pack, "download"


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    path = Path(argv[0]) if argv else graph_path()
    pack = build_pack()
    save_pack(pack, path)
    size_mb = path.stat().st_size / 1e6
    print(
        f"Saved {pack.graph.number_of_nodes()} nodes and {pack.graph.number_of_edges()} edges "
        f"to {path} ({size_mb:.1f} MB)"
    )


if __name__ == "__main__":
    # Run through the importable module, so the pickle refers to
    # street_graph.StreetPack and not __main__.StreetPack, which the server
    # could not find when it loads the file.
    import street_graph

    street_graph.main()
