import hashlib
import json
import logging
import random
import re
import secrets

import requests

from config import settings
from prompts import CRISIS_RESPONSE, get_phase_prompt
from schemas import ResponseData

logger = logging.getLogger(__name__)

# Identifiers must never be written to logs verbatim. They are replaced with a
# pseudonym that is stable within one process run only.
_LOG_SALT = secrets.token_hex(16)


def _pseudonymize(value):
    if not value:
        return None
    digest = hashlib.sha256(f"{_LOG_SALT}:{value}".encode("utf-8")).hexdigest()
    return f"id_{digest[:12]}"


def _active_api_key():
    """Read the key per call so a configuration change does not need a restart."""
    return (settings.groq_api_key or "").strip()


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


# --- Crisis detection -------------------------------------------------------
# Mirrors backend/utils/crisisDetection.js so the same messages escalate whether
# they are caught by the Node layer or here. Detection runs before any model call
# and never depends on the model being reachable.
_LEET_MAP = str.maketrans(
    {
        "0": "o",
        "1": "i",
        "3": "e",
        "4": "a",
        "5": "s",
        "6": "g",
        "7": "t",
        "8": "b",
        "9": "g",
        "@": "a",
        "$": "s",
        "|": "i",
    }
)

_HIGH_RISK_PATTERNS = [
    r"\bsuicid(?:e|al)\b",
    r"\b(?:commit|committing|attempt|attempting|attempted)\s+suicide\b",
    r"\b(?:kill|killing)\s+(?:myself|me)\b",
    r"\bi\s+(?:want|wanna|wish)\s+(?:to\s+|2\s+)?(?:die|be\s+dead)\b",
    r"\b(?:rather|better)\s+off\s+dead\b",
    r"\bnot\s+worth\s+living\b",
    r"\b(?:no|zero)\s+(?:reason|point)\s+(?:to|in)\s+liv(?:e|ing)\b",
    r"\bend\s+my\s+life\b",
    r"\b(?:take|taking|took)\s+my\s+(?:own\s+)?life\b",
    r"\b(?:want|plan|planning|going|ready)\s+to\s+end\s+it\s+all\b",
    r"\bself\s*-?\s*(?:harm|harming|hurt|injury|mutilation)\b",
    r"\b(?:harm|hurt|cut|cutting|injure|injuring)\s+myself\b",
    r"\bcut\s+my\s+(?:body|wrist|wrists|arm|arms|thigh|legs)\b",
    r"\boverdos(?:e|ing|ed)\b",
    r"\bsuicide\s+(?:note|plan|method|attempt)\b",
    r"\b(?:kms|kys|kysmt)\b",
    r"\boff\s+myself\b",
    r"\bunalive\s+myself\b",
    r"\b(?:hang|hanging)\s+myself\b",
    r"\bgoodbye\s+forever\b",
    r"\bthis\s+is\s+my\s+(?:last|final)\s+(?:message|goodbye|note)\b",
]

# Ambiguous phrases only escalate when the message is self-referential, so benign
# uses ("let's end it there") are not flagged. A bare "end it" is deliberately
# excluded: only "end it all" is escalated.
_AMBIGUOUS_RISK_PATTERNS = [
    r"\b(?:can'?t|cannot|can\s+not)\s+(?:go\s+on|do\s+this\s+anymore|keep\s+going|take\s+(?:it|this)\s+anymore)\b",
    r"\b(?:do\s+not|don'?t)\s+want\s+to\s+(?:be\s+here|wake\s+up|exist|live)\b",
    r"\bwish\s+i\s+(?:was|were)\s+(?:dead|gone|never\s+born)\b",
    r"\b(?:nobody|no\s+one)\s+would\s+(?:care|notice|miss\s+me)\b",
    r"\bdisappear\s+forever\b",
    r"\b(?:feel|feeling|am|being)\s+(?:like\s+)?(?:a\s+)?burden\b",
    r"\bwouldn'?t\s+miss\s+me\b",
]

# Only applied when the message contained spaced-out letters (obfuscation).
_OBFUSCATED_COMPACT_PHRASES = [
    "killmyself",
    "killingmyself",
    "wanttodie",
    "wannadie",
    "wishtodie",
    "endmylife",
    "enditall",
    "takemylife",
    "takemyownlife",
    "betteroffdead",
    "notworthliving",
    "offmyself",
    "unalivemyself",
    "hangmyself",
    "cutmyself",
    "hurtmyself",
    "harmmyself",
]

_SPACED_LETTERS = re.compile(r"\b(?:[a-z]\s+){2,}[a-z]\b")
_SELF_REFERENCE = re.compile(r"\b(i|me|my|myself|i'm|i've)\b")


def collapse_spaced_letters(text: str) -> str:
    return _SPACED_LETTERS.sub(lambda match: re.sub(r"\s+", "", match.group(0)), text)


def normalize_for_detection(text) -> str:
    if not isinstance(text, str):
        return ""
    lowered = text.lower().replace("\u2018", "'").replace("\u2019", "'")
    deleeted = lowered.translate(_LEET_MAP)
    collapsed = collapse_spaced_letters(deleeted)
    punctuation_to_space = re.sub(r"[^a-z0-9'\s]", " ", collapsed)
    return re.sub(r"\s+", " ", punctuation_to_space).strip()


def detect_crisis_indicators(user_message: str) -> dict:
    """Detect crisis indicators. Returns risk level and the matched signals."""
    normalized = normalize_for_detection(user_message)

    if not normalized:
        return {"has_risk": False, "risk_level": "none", "keywords": []}

    keywords = [pattern for pattern in _HIGH_RISK_PATTERNS if re.search(pattern, normalized)]

    if isinstance(user_message, str):
        lowered = user_message.lower()
        if collapse_spaced_letters(lowered) != lowered:
            compact = re.sub(r"[^a-z0-9]", "", normalized)
            keywords.extend(
                f"obfuscated:{phrase}"
                for phrase in _OBFUSCATED_COMPACT_PHRASES
                if phrase in compact
            )

    if keywords:
        return {"has_risk": True, "risk_level": "high", "keywords": keywords}

    ambiguous = [pattern for pattern in _AMBIGUOUS_RISK_PATTERNS if re.search(pattern, normalized)]
    if ambiguous and _SELF_REFERENCE.search(normalized):
        return {"has_risk": True, "risk_level": "moderate", "keywords": ambiguous}

    return {"has_risk": False, "risk_level": "none", "keywords": []}


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


_MAX_CONTENT_LENGTH = 6000


def _model_reply_text(resp_json):
    """Extract the assistant text from an OpenAI/Groq-compatible response body."""
    if isinstance(resp_json, dict):
        choices = resp_json.get("choices")
        if isinstance(choices, list) and choices:
            first = choices[0]
            if isinstance(first, dict):
                message_obj = first.get("message")
                if isinstance(message_obj, dict) and message_obj.get("content"):
                    return str(message_obj["content"])
                if first.get("text"):
                    return str(first["text"])
        output = resp_json.get("output")
        if isinstance(output, list) and output:
            first_out = output[0]
            if isinstance(first_out, dict):
                candidate = first_out.get("content") or first_out.get("text")
                if candidate:
                    return str(candidate)
            return str(first_out)

    try:
        return json.dumps(resp_json)
    except (TypeError, ValueError):
        return ""


def _first_sentence(text):
    """Best-effort validation line. Only used when the model omits the field."""
    if not text:
        return None
    first_line = text.split("\n")[0].strip()
    match = re.match(r".*?[.!?](?:\s|$)", first_line)
    if match:
        return match.group(0).strip()
    return first_line[:200]


def _trailing_question(text):
    """Best-effort trailing question. Only used when the model omits the field."""
    if not text:
        return None
    questions = re.findall(r"[^?!.\n\r]{3,}\?", text)
    return questions[-1].strip() if questions else None


def _parse_json_reply(text):
    """Parse a JSON object from the model reply, tolerating code fences/prose."""
    if not text:
        return None

    candidate = text.strip()
    if candidate.startswith("```"):
        candidate = re.sub(r"^```[a-zA-Z]*\s*", "", candidate)
        candidate = re.sub(r"\s*```$", "", candidate).strip()

    parsed = None
    try:
        parsed = json.loads(candidate)
    except (TypeError, ValueError):
        start = candidate.find("{")
        end = candidate.rfind("}")
        if start != -1 and end > start:
            try:
                parsed = json.loads(candidate[start : end + 1])
            except (TypeError, ValueError):
                parsed = None

    return parsed if isinstance(parsed, dict) else None


def _normalize_risk_flags(value):
    if not isinstance(value, list):
        return []
    flags = []
    for item in value:
        if isinstance(item, str) and item.strip():
            flag = item.strip().upper()
            if flag not in flags:
                flags.append(flag)
    return flags[:10]


def _to_response_data(raw, trust_phase):
    """Normalise model output into the enforced response contract.

    Structured JSON from the model is used directly; the heuristics below only
    apply when the model returned unstructured text (degradation path).
    """
    if isinstance(raw, dict):
        content = _clean_text(raw.get("content")) or _clean_text(raw.get("text"))
        if content is None and any(
            raw.get(key)
            for key in ("emotional_validation", "tiny_action", "reconnection_nudge", "followup_question")
        ):
            content = _compose_natural_content(raw)
        content = (content or "")[:_MAX_CONTENT_LENGTH]

        payload = {
            "content": content,
            "emotional_validation": _clean_text(raw.get("emotional_validation"))
            or _first_sentence(content),
            "reconnection_nudge": _clean_text(raw.get("reconnection_nudge")),
            "tiny_action": _clean_text(raw.get("tiny_action")),
            "followup_question": _clean_text(raw.get("followup_question"))
            or _trailing_question(content),
            "risk_flags": _normalize_risk_flags(raw.get("risk_flags")),
            "trust_phase": trust_phase,
        }
    else:
        content = (_clean_text(raw) or "")[:_MAX_CONTENT_LENGTH]
        payload = {
            "content": content,
            "emotional_validation": _first_sentence(content),
            "reconnection_nudge": None,
            "tiny_action": None,
            "followup_question": _trailing_question(content),
            "risk_flags": [],
            "trust_phase": trust_phase,
        }

    return ResponseData(**payload)


def generate_response(
    user_message: str, trust_phase: str = "listening", user_id: str = None
) -> dict:
    """
    Generate a structured AI response using a Groq-compatible API.

    Args:
        user_message: The user's input message
        trust_phase: Current trust phase (listening, momentum, accountability)
        user_id: Optional user identifier for logging

    Returns:
        Dictionary with structured response format
    """

    # Crisis handling runs before the model call so it can never depend on the
    # model being reachable.
    crisis_check = detect_crisis_indicators(user_message)
    if crisis_check["has_risk"]:
        logger.warning(
            "crisis_detected risk_level=%s user=%s",
            crisis_check["risk_level"],
            _pseudonymize(user_id),
        )
        return {
            "success": True,
            "data": ResponseData(
                content=CRISIS_RESPONSE,
                emotional_validation="I hear the depth of your pain.",
                risk_flags=["CRISIS_DETECTED"],
                trust_phase=trust_phase,
            ).model_dump(),
        }

    try:
        prompt_template = get_phase_prompt(trust_phase)
        context_guidance = get_context_guidance(user_message)
        system_prompt = prompt_template.format(
            user_message=user_message,
            context_guidance=context_guidance,
        )

        api_key = _active_api_key()
        if not api_key:
            logger.warning("No Groq API key configured, using fallback response")
            return get_fallback_response(user_message, trust_phase=trust_phase)

        payload = {
            "model": settings.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "temperature": settings.temperature,
            "max_tokens": settings.max_tokens,
            # Structured output replaces guessing the fields out of free text
            # (the text heuristics remain only as a degradation path).
            "response_format": {"type": "json_object"},
        }

        response = requests.post(
            settings.api_base_url.rstrip("/") + "/chat/completions",
            json=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=settings.request_timeout_seconds,
        )
        response.raise_for_status()

        reply_text = _model_reply_text(response.json())
        structured_reply = _parse_json_reply(reply_text)

        if structured_reply is None:
            # Degradation path: the model returned prose instead of JSON.
            logger.info("model_reply_not_json; using text heuristics")
            structured_reply = reply_text

        data = _to_response_data(structured_reply, trust_phase)

        # For longing statements, prefer a gentle tailored follow-up question.
        if _is_longing_statement(user_message):
            person_label = _extract_missing_person_label(user_message)
            object_pronoun = _infer_object_pronoun(person_label)

            data.followup_question = _longing_followup_question(user_message, object_pronoun)

            if not _clean_text(data.emotional_validation):
                data.emotional_validation = (
                    f"That sounds really painful, and I can hear how much {person_label} means to you."
                )

        logger.info("generated_response phase=%s user=%s", trust_phase, _pseudonymize(user_id))

        return {"success": True, "data": data.model_dump()}

    except Exception as exc:
        logger.error("Error generating response: %s", exc)
        return get_fallback_response(user_message, trust_phase=trust_phase)


def get_fallback_response(user_message: str, trust_phase: str = "listening") -> dict:
    """Crisis-aware fallback used when the model is unavailable.

    The crisis branch is evaluated here as well as in generate_response so an API
    failure can never downgrade a crisis message to a generic reassuring reply.
    """
    crisis_check = detect_crisis_indicators(user_message)
    if crisis_check["has_risk"]:
        logger.warning("crisis_detected_in_fallback risk_level=%s", crisis_check["risk_level"])
        return {
            "success": True,
            "data": ResponseData(
                content=CRISIS_RESPONSE,
                emotional_validation="I hear the depth of your pain.",
                risk_flags=["CRISIS_DETECTED"],
                trust_phase=trust_phase,
            ).model_dump(),
        }

    if _is_longing_statement(user_message):
        person_label = _extract_missing_person_label(user_message)
        content = (
            f"It sounds painful to miss {person_label}, and it makes sense that this is weighing on you.\n\n"
            f"{_longing_followup_question(user_message, _infer_object_pronoun(person_label))}"
        )
    else:
        guidance = get_context_guidance(user_message)
        if "consolation" in guidance:
            validation = "That sounds like a heavy loss, and it makes sense that you need space for it."
        elif "grounding" in guidance:
            validation = "That sounds frightening and overwhelming; you deserve to feel safe and supported."
        elif "disappointment" in guidance:
            validation = "That setback sounds painful, and it makes sense that you feel discouraged."
        else:
            validation = "I hear you, and it sounds like this is taking a lot out of you."
        content = (
            f"{validation}\n\n"
            "If it feels manageable, take one slow breath and name what feels most important right now."
        )

    return {
        "success": True,
        "data": ResponseData(
            content=content,
            emotional_validation=_first_sentence(content),
            followup_question=_trailing_question(content),
            risk_flags=["FALLBACK_ACTIVE"],
            trust_phase=trust_phase,
        ).model_dump(),
    }
