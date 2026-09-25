"""Crisis detection tests.

These cases intentionally mirror backend/tests/crisisDetection.test.js so both
layers escalate the same messages: the backend must catch a crisis even when this
service is unreachable.
"""

import pytest

from ai_engine import collapse_spaced_letters, detect_crisis_indicators, normalize_for_detection

HIGH_RISK_CASES = [
    "I want to die",
    "I wanna die most days",
    "I've been thinking about suicide",
    "I am going to kill myself",
    "I keep cutting myself when it gets bad",
    "I want to end my life",
    "I'd be better off dead",
    "Sometimes I feel like I am not worth living",
    "I want to end it all",
    "honestly I want to kms",
    "please stop saying kys to me",
    "I have been planning to off myself",
    "I took my own life last year",
    "i want 2 die",
    "I am thinking about s u i c i d e",
]

MODERATE_RISK_CASES = [
    "I cannot go on like this anymore",
    "I do not want to be here anymore",
    "I wish I was dead",
    "Nobody would care if I was gone",
    "I feel like a burden to everyone",
]


@pytest.mark.parametrize("message", HIGH_RISK_CASES)
def test_detects_high_risk(message):
    result = detect_crisis_indicators(message)
    assert result["has_risk"] is True
    assert result["risk_level"] == "high"
    assert result["keywords"]


@pytest.mark.parametrize("message", MODERATE_RISK_CASES)
def test_detects_moderate_risk(message):
    result = detect_crisis_indicators(message)
    assert result["has_risk"] is True
    assert result["risk_level"] == "moderate"


@pytest.mark.parametrize(
    "message",
    [
        "I want to d1e",
        "kill.myself tonight",
        "k i l l m y s e l f",
    ],
)
def test_detects_leetspeak_punctuation_and_spacing(message):
    assert detect_crisis_indicators(message)["has_risk"] is True


@pytest.mark.parametrize(
    "message",
    [
        "Let's end it there for today",
        "I will end it tomorrow morning at work",
        "I am exhausted after a long week",
        "Work is stressful but I am managing",
        "I do not want to die, I want to feel better",
    ],
)
def test_does_not_escalate_ordinary_text(message):
    assert detect_crisis_indicators(message)["has_risk"] is False


@pytest.mark.parametrize("message", ["", None, "   "])
def test_handles_empty_input(message):
    result = detect_crisis_indicators(message)
    assert result == {"has_risk": False, "risk_level": "none", "keywords": []}


def test_literal_risk_vocabulary_escalates_in_third_person_contexts():
    """Fail-safe trade-off: over-escalating costs a supportive message only."""
    assert detect_crisis_indicators("My friend keeps joking about kys")["risk_level"] == "high"
    assert detect_crisis_indicators("Suicide prevention training was today")["risk_level"] == "high"


def test_normalize_for_detection_expands_obfuscation():
    assert normalize_for_detection("K1LL   MYSELF!!") == "kill myself"
    assert normalize_for_detection("k i l l  m y s e l f") == "killmyself"
    assert normalize_for_detection(None) == ""


def test_collapse_spaced_letters_ignores_real_words():
    assert collapse_spaced_letters("k i l l") == "kill"
    assert collapse_spaced_letters("skill metering") == "skill metering"
