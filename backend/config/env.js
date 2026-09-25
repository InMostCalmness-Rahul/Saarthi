import { randomBytes } from 'node:crypto';

// Environment access with explicit, fail-fast validation for production.

const DEFAULT_DEV_CORS_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const MIN_SECRET_LENGTH = 32;
const DEFAULT_TOKEN_TTL_DAYS = 30;

let cachedSecret = null;
let warnedAboutEphemeralSecret = false;

export function isProduction() {
  return process.env.NODE_ENV === 'production';
}

export function isTest() {
  return process.env.NODE_ENV === 'test';
}

/**
 * Auth secret resolution:
 * - production: a >= 32 char AUTH_SECRET is mandatory (throws otherwise)
 * - development/test: falls back to an ephemeral per-process secret with a warning
 */
export function getAuthSecret() {
  if (cachedSecret) {
    return cachedSecret;
  }

  const configured = (process.env.AUTH_SECRET || '').trim();

  if (configured.length >= MIN_SECRET_LENGTH) {
    cachedSecret = configured;
    return cachedSecret;
  }

  if (isProduction()) {
    throw new Error(
      `AUTH_SECRET must be set to a random value of at least ${MIN_SECRET_LENGTH} characters when NODE_ENV=production`
    );
  }

  if (configured.length > 0) {
    console.warn(
      `[config] AUTH_SECRET is shorter than ${MIN_SECRET_LENGTH} characters; ignoring it outside production.`
    );
  }
  if (!warnedAboutEphemeralSecret) {
    console.warn(
      '[config] AUTH_SECRET is not configured; using an ephemeral development secret. Sessions are invalidated on restart.'
    );
    warnedAboutEphemeralSecret = true;
  }

  cachedSecret = randomBytes(48).toString('hex');
  return cachedSecret;
}

export function getCorsOrigins() {
  const configured = (process.env.CORS_ORIGINS || '').trim();
  if (configured) {
    return configured
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }
  return [...DEFAULT_DEV_CORS_ORIGINS];
}

export function getTokenTtlMs() {
  const days = Number(process.env.AUTH_TOKEN_TTL_DAYS || DEFAULT_TOKEN_TTL_DAYS);
  const safeDays = Number.isFinite(days) && days > 0 ? days : DEFAULT_TOKEN_TTL_DAYS;
  return safeDays * 24 * 60 * 60 * 1000;
}

export function isRateLimitDisabled() {
  return process.env.RATE_LIMIT_DISABLED === '1' || isTest();
}

export function getAiServiceApiKey() {
  return (process.env.AI_SERVICE_API_KEY || '').trim();
}

export function getMongoUri() {
  return (process.env.MONGODB_URI || '').trim();
}

/**
 * Called during startup so misconfiguration fails loudly instead of surfacing
 * as a runtime 500 or an insecure default.
 */
export function assertServerEnv() {
  getAuthSecret();
  if (!getMongoUri()) {
    throw new Error('MONGODB_URI is not set in environment variables');
  }
}
