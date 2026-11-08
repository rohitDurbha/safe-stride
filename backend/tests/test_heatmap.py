import json
import math
from pathlib import Path

import pandas as pd
import pytest

from heatmap import heatmap_points, parse_point, UNKNOWN_TYPE

CSV = Path(__file__).resolve().parents[1] / "crime_rate.csv"


def test_parses_point_strings():
    assert parse_point("POINT (-122.16835 37.75697)") == (-122.16835, 37.75697)


@pytest.mark.parametrize("value", [None, math.nan, "", "POINT EMPTY", "POINT (0 0)", "POINT (500 37)", 42])
def test_rejects_missing_or_invalid_locations(value):
    assert parse_point(value) is None


def test_missing_crime_type_becomes_unknown_instead_of_nan():
    crimes = [{"CRIMETYPE": math.nan, "Location": "POINT (-122.2 37.8)"}, {"Location": "POINT (-122.3 37.8)"}]
    points = heatmap_points(crimes, [])
    assert [p["properties"]["type"] for p in points] == [UNKNOWN_TYPE, UNKNOWN_TYPE]


def test_reports_without_a_usable_location_are_skipped():
    reports = [
        {"incident_type": "ROBBERY", "location": {"lat": 37.8, "lon": -122.27}},
        {"incident_type": "ROBBERY", "location": {"lat": None, "lon": None}},
        {"incident_type": "ROBBERY", "location": {}},
        {"incident_type": "ROBBERY"},
        {"incident_type": "ROBBERY", "location": {"lat": "abc", "lon": -122}},
    ]
    points = heatmap_points([], reports)
    assert len(points) == 1
    assert points[0]["geometry"]["coordinates"] == [-122.27, 37.8]
    assert points[0]["properties"] == {"type": "ROBBERY", "intensity": 0.9}


def test_dataset_imported_with_pandas_gives_strict_json():
    # Importing the CSV with pandas stores empty cells as NaN, which is how
    # the heatmap broke. The response must still be valid strict JSON.
    crimes = pd.read_csv(CSV).head(150).to_dict("records")
    assert any(isinstance(c["Location"], float) for c in crimes)

    points = heatmap_points(crimes, [])

    body = json.dumps(points, allow_nan=False)
    assert len(json.loads(body)) > 100
