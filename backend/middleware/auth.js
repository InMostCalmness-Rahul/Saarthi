import { getAuthSecret, isRateLimitDisabled } from '../config/env.js';
import { extractBearerToken, verifyToken } from '../utils/token.js';
import { logSecurityEvent, logger } from '../utils/logger.js';
import { forbidden, unauthorized } from '../utils/http.js';

/**
 * Verifies the signed session token and attaches the server-minted identity.
 * Identity is never read from the request body or query string.
 */
export function requireAuth(req, res, next) {
  const token = extractBearerToken(req.get('authorization'));

  if (!token) {
    logSecurityEvent('auth_missing_token', req);
    return next(unauthorized());
  }

  let payload;
  try {
    payload = verifyToken(token, getAuthSecret());
  } catch (error) {
    logger.error('auth_token_verification_failed', error);
    return next(unauthorized('Invalid or expired session token'));
  }

  if (!payload) {
    logSecurityEvent('auth_invalid_token', req);
    return next(unauthorized('Invalid or expired session token'));
  }

  req.userId = payload.sub;
  req.tokenExpiresAt = new Date(payload.exp).toISOString();
  return next();
}

/**
 * Guards legacy user-scoped URLs (/resource/:userId). The path parameter may only
 * ever reference the authenticated user, which closes the previous IDOR surface
 * without breaking already-published URLs.
 */
export function requireOwnership(req, res, next) {
  const requestedUserId = req.params?.userId;

  if (!requestedUserId) {
    return next();
  }

  if (requestedUserId !== req.userId) {
    logSecurityEvent('auth_ownership_violation', req, { requestedUserId, actualUserId: req.userId });
    return next(forbidden('You are not allowed to access another user\'s data'));
  }

  return next();
}

/**
 * Rejects a body userId that disagrees with the authenticated identity. Applied to
 * write endpoints that historically accepted userId in the payload.
 */
export function rejectConflictingBodyUserId(req, res, next) {
  const bodyUserId = req.body?.userId;

  if (bodyUserId !== undefined && bodyUserId !== req.userId) {
    logSecurityEvent('auth_body_identity_mismatch', req, { bodyUserId, actualUserId: req.userId });
    return next(forbidden('Request body userId does not match the authenticated user'));
  }

  return next();
}

/**
 * Minimal fixed-window in-memory limiter. Adequate for abuse-dampening on a single
 * instance; swap for a shared store when running multiple replicas.
 */
export function createRateLimiter({ windowMs, max, name }) {
  const hits = new Map();
  const MAX_TRACKED_CLIENTS = 5000;

  function sweep(now) {
    if (hits.size < MAX_TRACKED_CLIENTS) {
      return;
    }
    for (const [key, entry] of hits.entries()) {
      if (now > entry.resetAt) {
        hits.delete(key);
      }
    }
  }

  return function rateLimiter(req, res, next) {
    if (isRateLimitDisabled()) {
      return next();
    }

    const now = Date.now();
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const entry = hits.get(key);

    if (!entry || now > entry.resetAt) {
      sweep(now);
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.set('Retry-After', String(retryAfterSeconds));
      logger.warn(`rate_limit_exceeded limiter=${name}`, { ip: key, count: entry.count });
      return res.status(429).json({
        success: false,
        error: { status: 429, message: 'Too many requests. Please slow down and try again shortly.' },
      });
    }

    return next();
  };
}
