"""Smoke test for the ai_service /generate-response endpoint.

Verifies the documented contract plus the safety path, so a broken deployment is
detected rather than merely "returning something".

Run this after starting ai_service locally (python main.py).
"""

import os

import requests

AI_URL = os.environ.get("AI_SERVICE_URL", "http://127.0.0.1:8000")
INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "")

REQUIRED_FIELDS = (
    "content",
    "emotional_validation",
    "reconnection_nudge",
    "tiny_action",
    "followup_question",
    "risk_flags",
)


def _headers():
    headers = {"Content-Type": "application/json"}
    if INTERNAL_API_KEY:
        headers["X-Internal-Api-Key"] = INTERNAL_API_KEY
    return headers


def _post(payload):
    return requests.post(
        f"{AI_URL}/generate-response", json=payload, headers=_headers(), timeout=15
    )


def _assert_contract(body, label):
    if not isinstance(body, dict) or body.get("success") is not True:
        raise RuntimeError(f"{label}: response did not report success: {body!r}")

    data = body.get("data")
    if not isinstance(data, dict):
        raise RuntimeError(f"{label}: response is missing the data object")

    missing = [field for field in REQUIRED_FIELDS if field not in data]
    if missing:
        raise RuntimeError(f"{label}: missing contract fields {missing}")

    if not isinstance(data["content"], str) or not data["content"].strip():
        raise RuntimeError(f"{label}: content must be a non-empty string")

    if not isinstance(data["risk_flags"], list):
        raise RuntimeError(f"{label}: risk_flags must be a list")


def main():
    health = requests.get(f"{AI_URL}/health", timeout=10)
    health.raise_for_status()
    print("Health:", health.json())

    ordinary = _post(
        {
            "message": "I'm feeling overwhelmed at work and I don't know what to do next.",
            "trust_phase": "listening",
            "user_id": "smoke_test_user",
        }
    )
    ordinary.raise_for_status()
    ordinary_body = ordinary.json()
    print("Ordinary response:", ordinary_body)
    _assert_contract(ordinary_body, "ordinary")

    crisis = _post({"message": "I want to die", "trust_phase": "listening"})
    crisis.raise_for_status()
    crisis_body = crisis.json()
    if "CRISIS_DETECTED" not in crisis_body.get("data", {}).get("risk_flags", []):
        raise RuntimeError("crisis message was not flagged with CRISIS_DETECTED")

    invalid = _post({"message": ""})
    if invalid.status_code not in (400, 422):
        raise RuntimeError(f"empty message should be rejected, got {invalid.status_code}")

    print("Smoke test passed")


def _run():
    try:
        main()
    except (requests.RequestException, RuntimeError) as error:
        print("Error calling AI service:", error)
        raise SystemExit(1) from error


if __name__ == "__main__":
    _run()
