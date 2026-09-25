// Trust phase thresholds mirror backend/config/constants.js TRUST_PHASE_BOUNDS
// so the UI can never disagree with the phase the server used for prompting.

export const TRUST_SCORE_MIN = 0;
export const TRUST_SCORE_MAX = 100;
export const TRUST_SCORE_DEFAULT = 50;

const PHASE_DETAILS = {
  listening: {
    key: "listening",
    name: "Listening Mode",
    hint: "I am focused on understanding what you are feeling without pushing too fast.",
  },
  momentum: {
    key: "momentum",
    name: "Momentum Mode",
    hint: "I will keep validating feelings while guiding one small next step.",
  },
  accountability: {
    key: "accountability",
    name: "Accountability Mode",
    hint: "I can now offer more direct pattern feedback with empathy.",
  },
};

export function clampTrustScore(score) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) {
    return TRUST_SCORE_DEFAULT;
  }
  return Math.min(TRUST_SCORE_MAX, Math.max(TRUST_SCORE_MIN, Math.round(numeric)));
}

export function getTrustPhase(score) {
  const clamped = clampTrustScore(score);
  if (clamped >= 70) {
    return PHASE_DETAILS.accountability.key;
  }
  if (clamped >= 40) {
    return PHASE_DETAILS.momentum.key;
  }
  return PHASE_DETAILS.listening.key;
}

/**
 * @param {number} score current trust score
 * @param {string} [serverPhase] phase reported by the API (authoritative when present)
 */
export function getPhaseDetails(score, serverPhase) {
  const key = PHASE_DETAILS[serverPhase] ? serverPhase : getTrustPhase(score);
  return PHASE_DETAILS[key];
}
