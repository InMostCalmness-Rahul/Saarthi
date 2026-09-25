"""ASGI-level tests for the FastAPI surface: contract, validation, CORS, auth."""

import json

import pytest
from fastapi.testclient import TestClient

from config import settings
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    """Keep tests off the network and un-gated; individual tests opt back in."""
    monkeypatch.setattr(settings, "groq_api_key", "", raising=False)
    monkeypatch.setattr(settings, "internal_api_key", "", raising=False)
    yield


def test_health_is_public_and_leaks_no_secrets():
    response = client.get("/health")
    assert response.status_code == 200

    body = response.json()
    assert body["status"] == "healthy"
    assert body["model"] == settings.model
    assert "groq" not in json.dumps(body).lower()


def test_generate_response_returns_the_documented_contract():
    response = client.post(
        "/generate-response",
        json={"message": "I feel stuck", "trust_phase": "listening", "user_id": "user_x"},
    )
    assert response.status_code == 200

    body = response.json()
    assert body["success"] is True
    assert {
        "content",
        "emotional_validation",
        "reconnection_nudge",
        "tiny_action",
        "followup_question",
        "risk_flags",
    } <= set(body["data"])
    assert isinstance(body["data"]["content"], str) and body["data"]["content"]


def test_message_validation():
    assert client.post("/generate-response", json={}).status_code == 422
    assert client.post("/generate-response", json={"message": ""}).status_code == 422
    assert client.post("/generate-response", json={"message": "a" * 4001}).status_code == 422
    # Whitespace-only passes the length check and is rejected by the handler.
    assert client.post("/generate-response", json={"message": "   "}).status_code == 400


def test_unknown_fields_are_rejected():
    response = client.post("/generate-response", json={"message": "hi", "unexpected": True})
    assert response.status_code == 422


def test_crisis_message_is_flagged_over_http():
    response = client.post("/generate-response", json={"message": "I want to die"})
    assert response.status_code == 200
    assert response.json()["data"]["risk_flags"] == ["CRISIS_DETECTED"]


def test_internal_api_key_is_enforced_only_when_configured(monkeypatch):
    monkeypatch.setattr(settings, "internal_api_key", "shared-secret-value", raising=False)

    assert client.post("/generate-response", json={"message": "hello"}).status_code == 401
    assert (
        client.post(
            "/generate-response",
            json={"message": "hello"},
            headers={"X-Internal-Api-Key": "wrong"},
        ).status_code
        == 401
    )

    accepted = client.post(
        "/generate-response",
        json={"message": "hello"},
        headers={"X-Internal-Api-Key": "shared-secret-value"},
    )
    assert accepted.status_code == 200


def test_cors_uses_an_explicit_allow_list_without_credentials():
    allowed_origin = settings.cors_origin_list[0]

    allowed = client.get("/health", headers={"Origin": allowed_origin})
    assert allowed.headers.get("access-control-allow-origin") == allowed_origin
    # "*" combined with credentials is invalid CORS, so credentials stay disabled.
    assert allowed.headers.get("access-control-allow-credentials") is None

    denied = client.get("/health", headers={"Origin": "https://evil.example.com"})
    assert denied.headers.get("access-control-allow-origin") is None
