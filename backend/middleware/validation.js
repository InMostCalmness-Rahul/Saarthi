import { LIMITS, SESSION_ID_PATTERN } from '../config/constants.js';
import { logger } from '../utils/logger.js';

// Request validation middleware.
// Note: user identity is intentionally NOT validated here — it comes from the
// signed session token (see middleware/auth.js), never from client input.

function validationError(res, message) {
  return res.status(400).json({
    success: false,
    error: { status: 400, message },
  });
}

export const requestValidator = (req, res, next) => {
  logger.debug(`incoming_request ${req.method} ${req.path}`);

  // Reject JSON-ish methods that do not declare a JSON body.
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const hasBody = req.headers['content-length'] && req.headers['content-length'] !== '0';
    if (hasBody && !req.is('application/json')) {
      return validationError(res, 'Content-Type must be application/json');
    }
  }

  return next();
};

export const validateChatMessage = (req, res, next) => {
  const { message, sessionId } = req.body ?? {};

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return validationError(res, 'Message is required and must be a non-empty string');
  }

  if (message.length > LIMITS.MESSAGE_MAX_LENGTH) {
    return validationError(
      res,
      `Message must be ${LIMITS.MESSAGE_MAX_LENGTH} characters or fewer`
    );
  }

  if (sessionId !== undefined && !SESSION_ID_PATTERN.test(sessionId)) {
    return validationError(res, 'sessionId must match the format session_<id>');
  }

  return next();
};

export const validateActionUpdate = (req, res, next) => {
  const { actionCommitment, completed, sessionId, trustScoreDelta } = req.body ?? {};

  if (!actionCommitment || typeof actionCommitment !== 'string') {
    return validationError(res, 'actionCommitment is required and must be a string');
  }

  if (actionCommitment.trim().length === 0 || actionCommitment.length > LIMITS.ACTION_MAX_LENGTH) {
    return validationError(
      res,
      `actionCommitment must be between 1 and ${LIMITS.ACTION_MAX_LENGTH} characters`
    );
  }

  if (typeof completed !== 'boolean') {
    return validationError(res, 'completed is required and must be a boolean');
  }

  // Trust deltas are server-authoritative: accepting one from a client would let
  // any caller pin their own score to 0 or 100 in a single request.
  if (trustScoreDelta !== undefined) {
    return validationError(
      res,
      'trustScoreDelta must not be supplied by clients; the server derives it from `completed`'
    );
  }

  if (sessionId !== undefined && sessionId !== null && !SESSION_ID_PATTERN.test(sessionId)) {
    return validationError(res, 'sessionId must match the format session_<id>');
  }

  return next();
};

export const validatePreferencesUpdate = (req, res, next) => {
  const { proactiveNudgesConsent } = req.body ?? {};

  if (typeof proactiveNudgesConsent !== 'boolean') {
    return validationError(res, 'proactiveNudgesConsent is required and must be a boolean');
  }

  return next();
};
