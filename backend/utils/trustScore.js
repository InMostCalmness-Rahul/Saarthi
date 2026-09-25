import {
  RISK_FLAGS,
  TRUST_DELTAS,
  TRUST_PHASE_BOUNDS,
  TRUST_PHASES,
  TRUST_SCORE_MAX,
  TRUST_SCORE_MIN,
} from '../config/constants.js';

export function clampTrustScore(score) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) {
    return TRUST_SCORE_MIN;
  }
  return Math.min(TRUST_SCORE_MAX, Math.max(TRUST_SCORE_MIN, Math.round(numeric)));
}

export function getTrustPhase(trustScore) {
  const score = clampTrustScore(trustScore);
  const match = TRUST_PHASE_BOUNDS.find((bound) => score >= bound.min);
  return match ? match.phase : TRUST_PHASES.LISTENING;
}

export function hasCrisisFlag(riskFlags = []) {
  return Array.isArray(riskFlags) && riskFlags.includes(RISK_FLAGS.CRISIS_DETECTED);
}

/**
 * Trust delta for one chat turn. Derived purely from server-side signals:
 * - a crisis turn must never reward the score
 * - offering a concrete tiny action counts slightly more than validation alone
 */
export function computeChatTrustDelta({ riskFlags = [], tinyAction = null } = {}) {
  if (hasCrisisFlag(riskFlags)) {
    return TRUST_DELTAS.CRISIS_DETECTED;
  }

  let delta = TRUST_DELTAS.CHAT_INTERACTION;
  if (typeof tinyAction === 'string' && tinyAction.trim().length > 0) {
    delta += TRUST_DELTAS.CHAT_TINY_ACTION;
  }
  return delta;
}

/**
 * Trust delta for an explicit action commitment. The client reports only whether
 * the action was completed; the magnitude is owned by the server.
 */
export function computeActionTrustDelta({ completed } = {}) {
  return completed ? TRUST_DELTAS.ACTION_COMPLETED : TRUST_DELTAS.ACTION_DECLINED;
}
