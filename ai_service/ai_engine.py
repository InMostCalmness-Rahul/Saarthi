import json
import logging
import random
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


def _clean_text(value):
    if isinstance(value, str):
        cleaned = value.strip()
        return cleaned if cleaned else None
    return None


def _compose_natural_content(structured_response):
    """Compose a single flowing response from structured response parts."""
    validation = _clean_text(structured_response.get("emotional_validation"))
    tiny_action = _clean_text(structured_response.get("tiny_action"))
    reconnection_nudge = _clean_text(structured_response.get("reconnection_nudge"))
    followup_question = _clean_text(structured_response.get("followup_question"))

    if not validation:
        validation = "I'm here with you."

    body_parts = [validation]

    if tiny_action:
        body_parts.append(f"If it feels okay, one small step could be: {tiny_action}")

    if reconnection_nudge:
        body_parts.append(f"You might also consider this: {reconnection_nudge}")

    body = " ".join(body_parts)

    if followup_question:
        return f"{body}\n\n{followup_question}"

    return body


def _user_wants_practical_help(user_message):
    text = user_message.lower()
    readiness_cues = [
        "what should i do",
        "what can i do",
        "next step",
        "help me",
        "how can i",
        "advice",
        "plan",
        "i want to move forward",
        "i'm ready",
    ]
    return any(cue in text for cue in readiness_cues)


def _is_longing_statement(user_message):
    text = user_message.lower()
    relationship_words = [
        "brother",
        "sister",
        "mother",
        "father",
        "mom",
        "dad",
        "friend",
        "partner",
        "wife",
        "husband",
        "son",
        "daughter",
    ]
    return ("i miss" in text or "miss my" in text) and any(
        word in text for word in relationship_words
    )


def _extract_missing_person_label(user_message):
    """Extract a safe person label from statements like 'I miss my brother'."""
    text = user_message.lower().strip()
    markers = ["i miss my ", "miss my "]

    for marker in markers:
        if marker in text:
            start = text.find(marker) + len(marker)
            tail = text[start:]
            stop_chars = [",", ".", "!", "?", " and ", " but "]
            cut = len(tail)
            for ch in stop_chars:
                idx = tail.find(ch)
                if idx != -1:
                    cut = min(cut, idx)
            label = tail[:cut].strip()
            if label:
                return f"your {label}"

    return "that person"


def _infer_object_pronoun(person_label):
    """Infer object pronoun from relationship label when clearly known."""
    label = person_label.lower().strip()

    male_labels = {"your brother", "your father", "your dad", "your husband", "your son"}
    female_labels = {"your sister", "your mother", "your mom", "your wife", "your daughter"}

    if label in male_labels:
        return "him"
    if label in female_labels:
        return "her"

    # For ambiguous labels like friend/partner, stay neutral.
    return "them"


def _longing_followup_question(user_message, object_pronoun):
    """Choose a gentle first follow-up for longing statements.

    Do not jump straight to listing memories/qualities.
    """
    text = user_message.lower()
    distance_cues = [
        "away",
        "far",
        "distance",
        "long-distance",
        "moved",
        "since",
    ]

    distance_questions = [
        f"How long has it been since you were close to {object_pronoun}?",
        f"When did you first start feeling this distance from {object_pronoun}?",
        "Has this feeling been getting heavier lately, or has it been this way for a while?",
    ]

    feeling_questions = [
        "How has this been feeling for you today?",
        "What feels hardest about this moment right now?",
        "What does this sense of missing them feel like in your day-to-day lately?",
    ]

    if any(cue in text for cue in distance_cues):
        return random.choice(distance_questions)

    return random.choice(feeling_questions)


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


def get_context_guidance(user_message: str) -> str:
    """Return style guidance based on emotional context in the user's message."""
    text = user_message.lower()

    grief_keywords = [
        "grief",
        "loss",
        "died",
        "passed away",
        "funeral",
        "mourning",
        "bereaved",
    ]
    trauma_keywords = [
        "trauma",
        "abuse",
        "assault",
        "violence",
        "ptsd",
        "flashback",
        "panic attack",
    ]
    failure_keywords = [
        "failed",
        "failure",
        "rejected",
        "mistake",
        "couldn't",
        "lost my job",
        "didn't get",
    ]

    if any(keyword in text for keyword in grief_keywords):
        return (
            "- Prioritize consolation and emotional presence over encouragement.\n"
            "- Use gentle, compassionate language that honors mourning and pain.\n"
            "- Avoid celebratory or motivational phrasing while grief is active.\n"
            "- If suggesting an action, keep it soft and optional (for example: breathing, journaling, reaching out for comfort)."
        )

    if any(keyword in text for keyword in trauma_keywords):
        return (
            "- Prioritize safety, grounding, and a calm tone.\n"
            "- Avoid language that pushes, pressures, or re-exposes the user to distress.\n"
            "- Offer stabilization-oriented steps (for example: sensory grounding, short pause, reaching trusted support).\n"
            "- Keep suggestions optional, gentle, and non-triggering."
        )

    if any(keyword in text for keyword in failure_keywords):
        return (
            "- Validate disappointment first, then gently nudge toward constructive perspective.\n"
            "- Reframe setbacks as part of learning without minimizing pain.\n"
            "- Suggest one practical next step that rebuilds confidence.\n"
            "- Use hopeful but realistic language."
        )

    return (
        "- Start with validation and understanding.\n"
        "- Match tone to the user's emotional intensity.\n"
        "- Keep action steps optional, concrete, and compassionate."
    )


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
        context_guidance = get_context_guidance(user_message)
        system_prompt = prompt_template.format(
            user_message=user_message,
            context_guidance=context_guidance,
        )

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

        # Treat the model output as a natural conversational reply (not rigid JSON).
        content = response_text

        # Heuristics to extract a short validation and any trailing question
        def _extract_first_sentence(text):
            if not text:
                return None
            # split on newline first, then on sentence end
            first_line = text.split("\n")[0].strip()
            # return up to first sentence terminator
            for sep in ['. ', '? ', '! ']:
                if sep in first_line:
                    return first_line.split(sep)[0].strip() + sep.strip()
            # no separator found; return first line (short)
            return (first_line[:200] + '...') if len(first_line) > 200 else first_line

        def _extract_trailing_question(text):
            if not text:
                return None
            import re as _re
            questions = _re.findall(r"([A-Z0-9a-z\s\'\"\,\-\(\)]+\?)", text)
            if questions:
                return questions[-1].strip()
            return None

        emotional_validation = _extract_first_sentence(content) or "I'm here to listen."
        followup_question = _extract_trailing_question(content)

        structured_response = {
            "content": content,
            "emotional_validation": emotional_validation,
            "reconnection_nudge": None,
            "tiny_action": None,
            "followup_question": followup_question,
            "risk_flags": [],
        }

        # For longing statements, prefer a gentle tailored follow-up question
        if _is_longing_statement(user_message):
            person_label = _extract_missing_person_label(user_message)
            object_pronoun = _infer_object_pronoun(person_label)

            # prefer a gentle custom followup rather than model-inferred one
            structured_response["followup_question"] = _longing_followup_question(
                user_message,
                object_pronoun,
            )

            # ensure validation is at least present
            current_validation = _clean_text(structured_response.get("emotional_validation"))
            if not current_validation:
                structured_response["emotional_validation"] = (
                    f"That sounds really painful, and I can hear how much {person_label} means to you."
                )

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
