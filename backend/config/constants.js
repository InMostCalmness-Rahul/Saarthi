// Central domain constants.
// Keeping tuning values here stops them from being inlined in controllers and
// gives tests a single source of truth to assert against.

export const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';
export const AI_SERVICE_TIMEOUT_MS = Number(process.env.AI_SERVICE_TIMEOUT_MS || 10000);

export const TRUST_SCORE_DEFAULT = 50;
export const TRUST_SCORE_MIN = 0;
export const TRUST_SCORE_MAX = 100;

export const TRUST_PHASES = {
  LISTENING: 'listening',
  MOMENTUM: 'momentum',
  ACCOUNTABILITY: 'accountability',
};

// Ordered from highest to lowest so lookup can stop at the first match.
export const TRUST_PHASE_BOUNDS = [
  { phase: TRUST_PHASES.ACCOUNTABILITY, min: 70 },
  { phase: TRUST_PHASES.MOMENTUM, min: 40 },
  { phase: TRUST_PHASES.LISTENING, min: 0 },
];

// Trust deltas are decided by the server only. A client can never supply one.
export const TRUST_DELTAS = {
  CHAT_INTERACTION: 3,
  CHAT_TINY_ACTION: 2,
  CRISIS_DETECTED: -10,
  ACTION_COMPLETED: 4,
  ACTION_DECLINED: -1,
};

export const RISK_FLAGS = {
  CRISIS_DETECTED: 'CRISIS_DETECTED',
  FALLBACK_ACTIVE: 'FALLBACK_ACTIVE',
};

export const TRUST_REASONS = {
  CHAT_INTERACTION: 'CHAT_INTERACTION',
  CRISIS_DETECTED: 'CRISIS_DETECTED',
  ACTION_COMPLETED: 'ACTION_COMPLETED',
  ACTION_DECLINED: 'ACTION_DECLINED',
};

// Input limits (also enforced by middleware/validation.js).
export const LIMITS = {
  MESSAGE_MAX_LENGTH: 4000,
  ACTION_MAX_LENGTH: 280,
};

export const USER_ID_PATTERN = /^user_[A-Za-z0-9-]{8,64}$/;
export const SESSION_ID_PATTERN = /^session_[A-Za-z0-9-]{8,64}$/;
