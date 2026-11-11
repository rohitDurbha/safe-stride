import pytest

import keyword_classifier as kc
import report_classifier as rc


@pytest.mark.parametrize(
    "transcript, expected",
    [
        ("Someone grabbed my bag and ran down Telegraph", "ROBBERY"),
        ("I just got mugged near the BART station", "ROBBERY"),
        ("a guy pulled a gun and took my phone", "ROBBERY"),
        ("there was a man waving a knife at people", "BRANDISHING"),
        ("I heard gunshots two blocks away", "WEAPONS"),
        ("somebody got stabbed outside the bar", "FELONY ASSAULT"),
        ("a man punched me in the face", "MISDEMEANOR ASSAULT"),
        ("someone has been following me for three blocks", "THREATS"),
        ("they stole my car from the driveway", "STOLEN VEHICLE"),
        ("someone smashed my car window and took my laptop", "BURG - AUTO"),
        ("people broke into the apartment next door", "BURG - RESIDENTIAL"),
        ("my bike was stolen from the rack", "PETTY THEFT"),
        ("lots of graffiti and spray painting on the wall", "VANDALISM"),
        ("someone set the dumpster on fire", "ARSON"),
        ("a drunk driver nearly hit me on the crosswalk", "DUI"),
        ("people dealing drugs on the corner", "NARCOTICS"),
        ("a big fight broke out in front of the store", "DISORDERLY CONDUCT"),
        ("a woman was pushed into a van against her will", "KIDNAPPING"),
    ],
)
def test_common_reports_get_a_category(transcript, expected):
    assert kc.keyword_category(transcript) == expected


def test_matching_ignores_case_and_extra_whitespace():
    assert kc.keyword_category("  SOMEONE   STOLE\nMY   CAR ") == "STOLEN VEHICLE"


@pytest.mark.parametrize("transcript", ["", "   ", "the street is very quiet tonight", "nice firework show"])
def test_reports_without_keywords_stay_unknown(transcript):
    assert kc.keyword_category(transcript) == kc.UNKNOWN


def test_word_fragments_do_not_match():
    # "fired" is not "fire" and "probe" is not "rob".
    assert kc.keyword_category("my manager fired me and sent a probe") == kc.UNKNOWN


def test_every_rule_uses_a_known_category():
    categories = [category for category, _ in kc._RULES]
    assert set(categories) <= set(rc.CRIME_CATEGORIES)
    assert len(categories) == len(set(categories))
    assert kc.UNKNOWN == rc.UNKNOWN
