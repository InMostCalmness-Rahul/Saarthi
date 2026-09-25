import { randomUUID } from 'node:crypto';
import { getOrCreateUser, findUser } from '../services/userService.js';
import { getAuthSecret, getTokenTtlMs } from '../config/env.js';
import { TRUST_SCORE_DEFAULT } from '../config/constants.js';
import { createToken } from '../utils/token.js';
import { getTrustPhase } from '../utils/trustScore.js';
import { asyncHandler, sendSuccess } from '../utils/http.js';
import { logger, pseudonymize } from '../utils/logger.js';

// POST /api/auth/session - Mint a server-side identity + signed session token.
//
// Identity is generated here and nowhere else: clients can no longer choose their
// own userId (previously `user_${Date.now()}` from localStorage, which made every
// user-scoped endpoint enumerable).
export const createSession = asyncHandler(async (req, res) => {
  const userId = `user_${randomUUID()}`;
  const user = await getOrCreateUser(userId);

  const { token, expiresAt } = createToken({
    subject: userId,
    secret: getAuthSecret(),
    ttlMs: getTokenTtlMs(),
  });

  logger.info('session_created', { userId: pseudonymize(userId) });

  return sendSuccess(
    res,
    {
      userId,
      token,
      expiresAt,
      trustScore: user.trustScore,
      trustPhase: getTrustPhase(user.trustScore),
      proactiveNudgesConsent: user.proactiveNudgesConsent,
    },
    201
  );
});

// GET /api/auth/me - Validate the current token and return the caller's identity.
export const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await findUser(req.userId);
  const trustScore = user?.trustScore ?? TRUST_SCORE_DEFAULT;

  return sendSuccess(res, {
    userId: req.userId,
    trustScore,
    trustPhase: getTrustPhase(trustScore),
    proactiveNudgesConsent: user?.proactiveNudgesConsent ?? false,
    consentUpdatedAt: user?.consentUpdatedAt ?? null,
    tokenExpiresAt: req.tokenExpiresAt ?? null,
  });
});
