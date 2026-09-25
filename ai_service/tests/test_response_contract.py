"""Response contract tests for the AI engine.

Covers the structured-output path (the model returns JSON), the degradation path
(prose is still handled), the crisis branches and the module integrity guard for
the previously duplicated module body.
"""

import json
from pathlib import Path

from pydantic import ValidationError
import pytest

import ai_engine
from ai_engine import (
    _first_sentence,
    _normalize_risk_flags,
    _parse_json_reply,
    _to_response_data,
    _trailing_question,
    generate_response,
    get_fallback_response,
)
from config import settings
from prompts import CRISIS_RESPONSE, get_phase_prompt
from schemas import GenerateResponseResponse, ResponseData


@pytest.fixture(autouse=True)
def _no_api_key(monkeypatch):
    """Keep every test off the network: an empty key selects the fallback path."""
    monkeypatch.setattr(settings, "groq_api_key", "", raising=False)


def test_module_body_is_not_duplicated():
    """Regression guard: ai_engine.py used to contain two copies of the module."""
    source = Path(ai_engine.__file__).read_text(encoding="utf-8")
    assert source.count("def generate_response(") == 1
    assert source.count("def get_fallback_response(") == 1
    assert source.count("import logging") == 1


def test_parse_json_reply_accepts_plain_and_fenced_json():
    payload = {"content": "I hear you.", "risk_flags": []}
    assert _parse_json_reply(json.dumps(payload)) == payload
    assert _parse_json_reply(f"```json\n{json.dumps(payload)}\n```") == payload
    assert _parse_json_reply(f"sure: {json.dumps(payload)} thanks") == payload
    assert _parse_json_reply("not json at all") is None
    assert _parse_json_reply("") is None
    assert _parse_json_reply("[1, 2, 3]") is None


def test_structured_reply_is_used_without_heuristics():
    data = _to_response_data(
        {
            "content": "That sounds heavy. What felt hardest today?",
            "emotional_validation": "That sounds heavy.",
            "tiny_action": "Write one sentence.",
            "reconnection_nudge": None,
            "followup_question": "What felt hardest today?",
            "risk_flags": ["crisis_detected", "crisis_detected"],
        },
        "momentum",
    )
    assert data.emotional_validation == "That sounds heavy."
    assert data.tiny_action == "Write one sentence."
    assert data.followup_question == "What felt hardest today?"
    assert data.risk_flags == ["CRISIS_DETECTED"]
    assert data.trust_phase == "momentum"


def test_prose_reply_degrades_to_heuristics():
    data = _to_response_data("I hear you. That sounds hard. What feels heaviest right now?", "listening")
    assert data.emotional_validation == "I hear you."
    assert data.followup_question == "What feels heaviest right now?"
    assert data.tiny_action is None


def test_partial_json_is_composed_into_content():
    data = _to_response_data(
        {"emotional_validation": "I hear you.", "tiny_action": "Take three breaths."}, "listening"
    )
    assert "I hear you." in data.content
    assert "Take three breaths." in data.content


def test_response_contract_rejects_missing_content():
    with pytest.raises(ValidationError):
        ResponseData(emotional_validation="only this")


def test_helper_edge_cases():
    assert _first_sentence(None) is None
    assert _first_sentence("No terminator here") == "No terminator here"
    assert _trailing_question("No question at all.") is None
    assert _trailing_question("Ready? Not yet? Yes?") == "Yes?"
    assert _normalize_risk_flags("CRISIS_DETECTED") == []
    assert _normalize_risk_flags([1, None, " ok "]) == ["OK"]


def test_generate_response_flags_crisis_without_calling_the_model():
    result = generate_response("I want to die", "listening", "user_test")
    assert result["success"] is True
    assert result["data"]["risk_flags"] == ["CRISIS_DETECTED"]
    assert result["data"]["content"] == CRISIS_RESPONSE


def test_generate_response_falls_back_without_an_api_key():
    result = generate_response("I am overwhelmed by work", "listening", "user_test")
    parsed = GenerateResponseResponse(**result)
    assert parsed.success is True
    assert "FALLBACK_ACTIVE" in parsed.data.risk_flags
    assert parsed.data.content


def test_fallback_is_crisis_aware_when_the_model_is_unavailable():
    """Regression: the fallback previously had no crisis branch."""
    crisis = get_fallback_response("I want to end it all", "listening")
    assert crisis["data"]["risk_flags"] == ["CRISIS_DETECTED"]
    assert crisis["data"]["content"] == CRISIS_RESPONSE

    ordinary = get_fallback_response("Work has been overwhelming", "listening")
    assert ordinary["data"]["risk_flags"] == ["FALLBACK_ACTIVE"]


def test_fallback_output_satisfies_the_response_contract():
    for message in ["I miss my brother", "I lost my job last month", "I feel anxious"]:
        parsed = GenerateResponseResponse(**get_fallback_response(message, "momentum"))
        assert parsed.data.trust_phase == "momentum"


def test_prompts_include_the_json_output_contract():
    for phase in ("listening", "momentum", "accountability", "unknown-phase"):
        prompt = get_phase_prompt(phase)
        assert "Output contract" in prompt
        assert '"content"' in prompt
        # str.format() renders the doubled braces into real JSON braces.
        rendered = prompt.format(user_message="hello", context_guidance="- be kind")
        assert '"risk_flags": []' in rendered
        assert "hello" in rendered
