"""Offline keyword rules for spoken safety reports.

Used when Gemini is not configured or the API call fails, so a report still
gets a category instead of always landing as UNKNOWN. The rules are checked
in order and the first one that matches wins. More specific and more serious
categories come first, so "someone pulled a gun and took my phone" is a
robbery rather than a weapons call, and "they stole my car" is a stolen
vehicle rather than a petty theft.
"""
import re

UNKNOWN = "UNKNOWN"

_RULES = (
    ("HOMICIDE", (
        r"\b(murder(ed)?|homicide)\b",
        r"\b(shot|stabbed|beaten) (to death|dead)\b",
        r"\b(killed|dead body)\b",
    )),
    ("KIDNAPPING", (
        r"\b(kidnap\w*|abduct\w*)\b",
        r"\b(forced|dragged|pulled|pushed) (me |him |her |them |someone |a \w+ )?into (a|the|their|his|her) (car|van|truck)\b",
    )),
    ("FORCIBLE RAPE", (
        r"\b(rape[ds]?|raping|sexual(ly)? assault(ed)?)\b",
    )),
    ("ROBBERY", (
        r"\b(rob(bed|bery|bing)?|mugg(ed|ing)|carjack\w*)\b",
        r"\bheld (me )?up\b",
        r"\bsnatch(ed|ing)?\b",
        r"\b(grabbed|took|ripped) my (bag|purse|phone|wallet|backpack)\b",
    )),
    ("FELONY ASSAULT", (
        r"\b(stabb(ed|ing)|slashed)\b",
        r"\b(shot at|got shot|been shot|was shot|shooting)\b",
        r"\b(beat(en)? up|beating someone|hit (me |him |her |them )?with a)\b",
    )),
    ("BRANDISHING", (
        r"\b(pulled|pointed|waved|waving|flashed|showed) (out )?(a|his|her|their) (gun|knife|pistol|weapon|blade)\b",
    )),
    ("WEAPONS", (
        r"\b(gun|guns|pistol|rifle|firearm|knife|machete)\b",
        r"\b(shots|gunshots|gunfire)\b",
    )),
    ("DOMESTIC VIOLENCE", (
        r"\bdomestic (violence|abuse|dispute)\b",
        r"\b(boyfriend|girlfriend|husband|wife|partner) (is )?(hit|hitting|beating|attacking|choking)\b",
    )),
    ("DUI", (
        r"\b(drunk|impaired) driv(er|ing)\b",
        r"\bdriving (drunk|high|under the influence)\b",
        r"\bdui\b",
    )),
    ("MISDEMEANOR ASSAULT", (
        r"\b(assault(ed)?|attack(ed|ing)?)\b",
        r"\b(punch(ed)?|slapp?(ed)?|shov(e|ed)|kick(ed)?)\b",
        r"\bhit (me|him|her|them|someone)\b",
        r"\b(pushed|spat on) (me|him|her|them|someone)\b",
    )),
    ("THREATS", (
        r"\bthreat(en(ed|ing)?|s)?\b",
        r"\b(follow(ed|ing) me|stalk(ed|ing)?)\b",
        r"\b(going to|gonna) (kill|hurt|get) (me|you)\b",
    )),
    ("ARSON", (
        r"\b(arson|set (a |on )?fire|set .{1,20} on fire|lit .{1,20} on fire)\b",
        r"\b(fire|burning|flames)\b",
    )),
    ("STOLEN VEHICLE", (
        r"\b(stole|stolen|took) (my |a |the |our )?(car|truck|van|motorcycle|scooter|vehicle)\b",
        r"\b(car|truck|van|motorcycle|vehicle) (was |got |is )?(stolen|missing)\b",
    )),
    ("BURG - AUTO", (
        r"\b(broke|broken|breaking) into (my |a |the |our )?(car|truck|van|vehicle)\b",
        r"\b(car|truck|van) (break[- ]?in|window)\b",
        r"\b(smashed|broke|broken) (my |a |the )?(car|truck|van) window\b",
    )),
    ("BURG - RESIDENTIAL", (
        r"\b(broke|broken|breaking) into (my |a |the |our |their )?(house|home|apartment|garage|place|unit)\b",
        r"\b(home|house|apartment) (was )?(burglar\w*|broken into)\b",
    )),
    ("BURG - COMMERCIAL", (
        r"\b(broke|broken|breaking) into (a |the )?(store|shop|business|restaurant|office)\b",
        r"\bburglar\w*\b",
    )),
    ("PETTY THEFT", (
        r"\b(stole|stolen|steal(ing)?|theft|thief|pickpocket\w*|shoplift\w*)\b",
        r"\b(took|swiped) my\b",
    )),
    ("VANDALISM", (
        r"\b(vandal\w*|graffiti|tagging|spray[- ]paint\w*)\b",
        r"\b(smash(ed|ing)|broke|broken|shatter(ed)?) (a |the |my |some )?windows?\b",
        r"\bkeyed my\b",
    )),
    ("NARCOTICS", (
        r"\b(drugs?|dealer|dealing|narcotics|fentanyl|meth|crack|heroin|needles?|syringes?)\b",
    )),
    ("PROSTITUTION", (
        r"\b(prostitut\w*|solicit(ed|ing))\b",
    )),
    ("GAMBLING", (
        r"\b(gambling|dice game)\b",
    )),
    ("FRAUD", (
        r"\b(scam\w*|fraud\w*|con artist)\b",
    )),
    ("DISORDERLY CONDUCT", (
        r"\b(fight(ing)?|brawl|harass\w*|yell(ed|ing) at|screaming at|drunk|disorderly)\b",
    )),
    ("CURFEW & LOITERING", (
        r"\b(loiter\w*|hanging around)\b",
    )),
)

_COMPILED = tuple(
    (category, tuple(re.compile(pattern, re.IGNORECASE) for pattern in patterns))
    for category, patterns in _RULES
)


def keyword_category(transcript):
    """Return the first category whose keywords appear in the transcript."""
    if not transcript or not transcript.strip():
        return UNKNOWN
    text = " ".join(transcript.split())
    for category, patterns in _COMPILED:
        if any(pattern.search(text) for pattern in patterns):
            return category
    return UNKNOWN
