import axios from 'axios';
import { AI_SERVICE_URL, AI_SERVICE_TIMEOUT_MS, RISK_FLAGS } from '../config/constants.js';
import { getAiServiceApiKey } from '../config/env.js';
import { CRISIS_FOLLOWUP, CRISIS_REPLY, detectCrisis } from '../utils/crisisDetection.js';
import { logger } from '../utils/logger.js';

// Single boundary between the Express API and the Python AI service.
// Everything the rest of the backend consumes from the model passes through
// normalizeAiResponse, so the stored shape is never "whatever the model said".

const MAX_FIELD_LENGTH = 4000;

function cleanText(value, maxLength = MAX_FIELD_LENGTH) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

export function normalizeRiskFlags(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const flags = value
    .filter((flag) => typeof flag === 'string')
    .map((flag) => flag.trim().toUpperCase())
    .filter(Boolean);
  return [...new Set(flags)].slice(0, 10);
}

export function firstSentence(text) {
  const cleaned = cleanText(text);
  if (!cleaned) {
    return null;
  }
  const firstLine = cleaned.split('\n')[0].trim();
  const match = firstLine.match(/.*?[.!?](\s|$)/);
  if (match) {
    return match[0].trim();
  }
  return firstLine.slice(0, 200);
}

export function trailingQuestion(text) {
  const cleaned = cleanText(text);
  if (!cleaned) {
    return null;
  }
  // Sentence terminators are excluded from the character class so each chunk is a
  // single question. Without that, the greedy class swallowed the entire message.
  const questions = cleaned.match(/[^?!.\n\r]{3,}\?/g);
  if (!questions || questions.length === 0) {
    return null;
  }
  return questions[questions.length - 1].trim();
}

/**
 * Coerces the AI service payload (structured JSON, or a bare string from an older
 * deployment) into the exact shape the database and API contract expose.
 * Field-level heuristics exist only as a degradation path for unstructured text.
 */
export function normalizeAiResponse(aiRaw) {
  if (typeof aiRaw === 'string') {
    const content = cleanText(aiRaw) ?? '';
    return {
      content,
      emotional_validation: firstSentence(content),
      reconnection_nudge: null,
      tiny_action: null,
      followup_question: trailingQuestion(content),
      risk_flags: [],
    };
  }

  if (!aiRaw || typeof aiRaw !== 'object') {
    const content = String(aiRaw ?? '');
    return {
      content,
      emotional_validation: firstSentence(content),
      reconnection_nudge: null,
      tiny_action: null,
      followup_question: trailingQuestion(content),
      risk_flags: [],
    };
  }

  const content =
    cleanText(aiRaw.content) ?? cleanText(aiRaw.text) ?? JSON.stringify(aiRaw).slice(0, MAX_FIELD_LENGTH);

  return {
    content,
    emotional_validation: cleanText(aiRaw.emotional_validation) ?? firstSentence(content),
    reconnection_nudge: cleanText(aiRaw.reconnection_nudge),
    tiny_action: cleanText(aiRaw.tiny_action),
    followup_question: cleanText(aiRaw.followup_question) ?? trailingQuestion(content),
    risk_flags: normalizeRiskFlags(aiRaw.risk_flags),
  };
}

export function buildCrisisResponse() {
  return {
    content: CRISIS_REPLY,
    emotional_validation: CRISIS_REPLY.split('\n\n')[0],
    reconnection_nudge: null,
    tiny_action: null,
    followup_question: CRISIS_FOLLOWUP,
    risk_flags: [RISK_FLAGS.CRISIS_DETECTED],
  };
}

/**
 * Crisis-aware fallback used when the AI service is unreachable/erroring.
 * Previously this path had no crisis branch at all, so a user in acute crisis
 * received a generic "take a moment to breathe" reply during an outage.
 */
export function buildFallbackResponse(userMessage) {
  const detection = detectCrisis(userMessage);
  if (detection.hasRisk) {
    return buildCrisisResponse();
  }

  return {
    content: [
      "I hear you, and it sounds like this is taking a lot out of you.",
      "I'm having trouble reaching my language model right now, so I want to keep this simple: take one slow breath and name what feels most important in this moment.",
      'What feels hardest about this right now?',
    ].join('\n\n'),
    emotional_validation: 'I hear you, and it sounds like this is taking a lot out of you.',
    reconnection_nudge: null,
    tiny_action: null,
    followup_question: 'What feels hardest about this right now?',
    risk_flags: [RISK_FLAGS.FALLBACK_ACTIVE],
  };
}

/**
 * Calls the AI service. Returns `{ response, fallbackUsed }` and never throws:
 * the caller must always be able to respond to the user.
 */
export async function requestAiResponse({ message, trustPhase, userId }) {
  const headers = {};
  const apiKey = getAiServiceApiKey();
  if (apiKey) {
    headers['X-Internal-Api-Key'] = apiKey;
  }

  try {
    const aiResponse = await axios.post(
      `${AI_SERVICE_URL}/generate-response`,
      { message, trust_phase: trustPhase, user_id: userId },
      { timeout: AI_SERVICE_TIMEOUT_MS, headers }
    );

    if (!aiResponse.data?.success) {
      throw new Error(`AI service returned an unsuccessful payload (${aiResponse.data?.error || 'unknown'})`);
    }

    return { response: normalizeAiResponse(aiResponse.data.data), fallbackUsed: false };
  } catch (error) {
    logger.warn('ai_service_unavailable', error);
    return { response: buildFallbackResponse(message), fallbackUsed: true };
  }
}
