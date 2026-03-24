import json
import logging
from openai import OpenAI
from config import settings
from prompts import get_phase_prompt, CRISIS_RESPONSE

logger = logging.getLogger(__name__)

# Initialize OpenAI-compatible client (OpenAI or Groq)
ACTIVE_API_KEY = settings.groq_api_key or settings.openai_api_key
client = (
    OpenAI(api_key=ACTIVE_API_KEY, base_url=settings.api_base_url)
    if ACTIVE_API_KEY
    else None
)


def detect_crisis_indicators(user_message: str) -> dict:
    """Detect if the message contains crisis indicators."""
    crisis_keywords = [
        "suicide",
        "kill myself",
        "want to die",
        "self harm",
        "cut myself",
        "end it",
    ]
    has_crisis = any(keyword in user_message.lower() for keyword in crisis_keywords)
    return {
        "has_risk": has_crisis,
        "risk_level": "high" if has_crisis else "none",
        "keywords": [kw for kw in crisis_keywords if kw in user_message.lower()],
    }


def generate_response(
    user_message: str, trust_phase: str = "listening", user_id: str = None
) -> dict:
    """
    Generate a structured AI response using OpenAI API.

    Args:
        user_message: The user's input message
        trust_phase: Current trust phase (listening, momentum, accountability)
        user_id: Optional user identifier for logging

    Returns:
        Dictionary with structured response format
    """

    # Check for crisis indicators
    crisis_check = detect_crisis_indicators(user_message)
    if crisis_check["has_risk"]:
        logger.warning(f"Crisis indicators detected for user {user_id}")
        return {
            "success": True,
            "data": {
                "emotional_validation": "I hear the depth of your pain.",
                "reconnection_nudge": None,
                "tiny_action": None,
                "followup_question": None,
                "risk_flags": ["CRISIS_DETECTED"],
                "content": CRISIS_RESPONSE,
            },
        }

    if client is None:
        logger.warning("No LLM API key configured, using fallback response")
        return get_fallback_response(user_message)

    try:
        prompt_template = get_phase_prompt(trust_phase)
        system_prompt = prompt_template.format(user_message=user_message)

        response = client.chat.completions.create(
            model=settings.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=settings.temperature,
            max_tokens=settings.max_tokens,
        )

        response_text = response.choices[0].message.content.strip()

        # Parse JSON response
        try:
            parsed_response = json.loads(response_text)
        except json.JSONDecodeError:
            logger.error(f"Failed to parse AI response as JSON: {response_text}")
            return get_fallback_response(user_message)

        # Ensure all required fields are present
        structured_response = {
            "emotional_validation": parsed_response.get(
                "emotional_validation", "I'm here to listen."
            ),
            "reconnection_nudge": parsed_response.get("reconnection_nudge"),
            "tiny_action": parsed_response.get("tiny_action"),
            "followup_question": parsed_response.get("followup_question"),
            "risk_flags": parsed_response.get("risk_flags", []),
        }

        # Generate final response text
        content_parts = [structured_response["emotional_validation"]]
        if structured_response["tiny_action"]:
            content_parts.append(f"\n\n{structured_response['tiny_action']}")
        if structured_response["reconnection_nudge"]:
            content_parts.append(f"\n\n{structured_response['reconnection_nudge']}")
        if structured_response["followup_question"]:
            content_parts.append(f"\n\n{structured_response['followup_question']}")

        structured_response["content"] = "".join(content_parts)

        logger.info(f"Generated response for user {user_id} in {trust_phase} phase")

        return {
            "success": True,
            "data": structured_response,
        }

    except Exception as e:
        logger.error(f"Error generating response: {e}")
        return get_fallback_response(user_message)


def get_fallback_response(user_message: str) -> dict:
    """Return a fallback response when API fails."""
    return {
        "success": True,
        "data": {
            "emotional_validation": "I hear you, and I'm here to listen.",
            "reconnection_nudge": None,
            "tiny_action": "Take a moment to breathe - you're doing the right thing by reaching out.",
            "followup_question": "What feels most important to focus on right now?",
            "risk_flags": ["FALLBACK_ACTIVE"],
            "content": "I hear you, and I'm here to listen.\n\nTake a moment to breathe - you're doing the right thing by reaching out.\n\nWhat feels most important to focus on right now?",
        },
    }
