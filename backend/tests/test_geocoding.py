from types import SimpleNamespace

import pytest

from geocoding import EndpointError, resolve_endpoints

PLACES = {
    "Oakland Convention Center": (37.8007, -122.2733),
    "UC Office of the President": (37.8047, -122.2690),
}


class FakeGeolocator:
    def __init__(self, places=PLACES):
        self.places = places
        self.queries = []

    def geocode(self, query, **kwargs):
        self.queries.append((query, kwargs))
        if query in self.places:
            lat, lon = self.places[query]
            return SimpleNamespace(latitude=lat, longitude=lon)
        return None


def test_typed_starting_point_is_used_instead_of_the_current_location():
    args = {
        "source": "Oakland Convention Center",
        "destination": "UC Office of the President",
        "start_lat": "37.8044",
        "start_lon": "-122.2711",
    }
    start, end = resolve_endpoints(args, FakeGeolocator())
    assert start == PLACES["Oakland Convention Center"]
    assert end == PLACES["UC Office of the President"]


def test_current_location_is_the_start_when_no_starting_point_is_typed():
    args = {"source": "  ", "destination": "UC Office of the President", "start_lat": "37.8044", "start_lon": "-122.2711"}
    start, end = resolve_endpoints(args, FakeGeolocator())
    assert start == (37.8044, -122.2711)
    assert end == PLACES["UC Office of the President"]


def test_picked_destination_coordinates_skip_geocoding():
    geo = FakeGeolocator()
    args = {"destination": "anything", "end_lat": "37.80", "end_lon": "-122.27", "start_lat": "37.81", "start_lon": "-122.26"}
    assert resolve_endpoints(args, geo) == ((37.81, -122.26), (37.80, -122.27))
    assert geo.queries == []


def test_searches_are_biased_to_oakland_first():
    geo = FakeGeolocator()
    resolve_endpoints({"destination": "UC Office of the President", "start_lat": "37.8", "start_lon": "-122.27"}, geo)
    assert geo.queries[0][1]["bounded"] is True


def test_unknown_place_is_a_404():
    with pytest.raises(EndpointError) as error:
        resolve_endpoints({"source": "Nowhere at all", "destination": "UC Office of the President"}, FakeGeolocator())
    assert error.value.status == 404
    assert "Starting point" in str(error.value)


@pytest.mark.parametrize(
    "args",
    [
        {"start_lat": "37.8", "start_lon": "-122.27"},
        {"destination": "UC Office of the President"},
        {"destination": "UC Office of the President", "start_lat": "abc", "start_lon": "-122.27"},
        {"destination": "UC Office of the President", "start_lat": "37.8"},
        {"destination": "UC Office of the President", "start_lat": "137.8", "start_lon": "-122.27"},
    ],
)
def test_missing_or_bad_input_is_a_400(args):
    with pytest.raises(EndpointError) as error:
        resolve_endpoints(args, FakeGeolocator())
    assert error.value.status == 400
