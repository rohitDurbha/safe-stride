"""Work out the start and end of a route from the request.

Each end can be given as coordinates (``start_lat``/``start_lon`` or
``end_lat``/``end_lon``), which the frontend sends when a suggestion is
picked, or as text (``source`` or ``destination``), which is geocoded.
Text wins over coordinates for the start, because the start coordinates
are the user's own location and only a fallback when no starting point
was typed.
"""
import math

# Bias searches to Oakland, where the street graph is.
OAKLAND_VIEWBOX = [(37.90, -122.35), (37.70, -122.15)]


class EndpointError(ValueError):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def _coordinate(args, lat_key, lon_key):
    raw_lat, raw_lon = args.get(lat_key), args.get(lon_key)
    if raw_lat in (None, "") and raw_lon in (None, ""):
        return None
    try:
        lat, lon = float(raw_lat), float(raw_lon)
    except (TypeError, ValueError):
        raise EndpointError(f"{lat_key} and {lon_key} must both be numbers")
    if not (math.isfinite(lat) and math.isfinite(lon) and -90 <= lat <= 90 and -180 <= lon <= 180):
        raise EndpointError(f"{lat_key} and {lon_key} are out of range")
    return lat, lon


def geocode(geolocator, query, label):
    location = geolocator.geocode(query, viewbox=OAKLAND_VIEWBOX, bounded=True)
    if not location:
        location = geolocator.geocode(query)
    if not location:
        raise EndpointError(f"{label} not found: {query}", status=404)
    return location.latitude, location.longitude


def resolve_endpoints(args, geolocator):
    """Return ((start_lat, start_lon), (end_lat, end_lon)) for a route request."""
    source = (args.get("source") or "").strip()
    destination = (args.get("destination") or "").strip()

    end = _coordinate(args, "end_lat", "end_lon")
    if end is None:
        if not destination:
            raise EndpointError("A destination is required")
        end = geocode(geolocator, destination, "Destination")

    if source:
        start = geocode(geolocator, source, "Starting point")
    else:
        start = _coordinate(args, "start_lat", "start_lon")
        if start is None:
            raise EndpointError("A starting point or the current location is required")

    return start, end
