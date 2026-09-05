"""
Simple smoke test for ai_service /generate-response endpoint.
Run this after starting ai_service locally (python main.py) and with ai_service/.env set.
"""
import requests
import os

AI_URL = os.environ.get("AI_SERVICE_URL", "http://127.0.0.1:8000")

def main():
    payload = {
        "message": "I'm feeling overwhelmed at work and I don't know what to do next.",
        "trust_phase": "listening",
        "user_id": "smoke_test_user"
    }

    try:
        resp = requests.post(f"{AI_URL}/generate-response", json=payload, timeout=10)
        print("Status:", resp.status_code)
        try:
            print("JSON:\n", resp.json())
        except Exception:
            print("Raw:\n", resp.text)
    except Exception as e:
        print("Error calling AI service:", e)


if __name__ == '__main__':
    main()
