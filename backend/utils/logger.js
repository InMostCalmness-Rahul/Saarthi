import { createHash, randomBytes } from 'node:crypto';

// Log hygiene helpers. Access logs and error logs previously wrote raw user ids
// (which also appear as URL path segments) and raw Mongoose/Atlas error strings.
//
// Pseudonyms are salted per process: stable enough to correlate a single run,
// not reversible by brute-forcing guessable ids (e.g. timestamp-based ids).
const PROCESS_SALT = process.env.LOG_SALT || randomBytes(16).toString('hex');

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const ID_TOKEN_PATTERN = /\b(?:user|session|msg|e2e_user|e2e_session)_[A-Za-z0-9-]{4,}\b/g;
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const LONG_DIGIT_PATTERN = /\b\d{9,}\b/g;
const CONNECTION_STRING_PATTERN = /(mongodb(?:\+srv)?:\/\/)[^\s@/]+@/gi;
const API_KEY_PATTERN = /\b(gsk_|sk-|api[_-]?key[=:]\s*)[A-Za-z0-9_\-.]{8,}/gi;

export function pseudonymize(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return value ?? null;
  }
  const digest = createHash('sha256')
    .update(PROCESS_SALT)
    .update(value)
    .digest('hex')
    .slice(0, 12);
  return `id_${digest}`;
}

export function redactUrl(url) {
  if (typeof url !== 'string') {
    return '';
  }
  return url
    .replace(ID_TOKEN_PATTERN, (match) => pseudonymize(match))
    .replace(UUID_PATTERN, (match) => pseudonymize(match))
    .replace(LONG_DIGIT_PATTERN, (match) => pseudonymize(match));
}

export function redactText(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value)
    .replace(CONNECTION_STRING_PATTERN, '$1***:***@')
    .replace(API_KEY_PATTERN, '$1***REDACTED***');
}

function configuredLevel() {
  const configured = String(process.env.LOG_LEVEL || 'info').toLowerCase();
  return LOG_LEVELS[configured] ?? LOG_LEVELS.info;
}

function shouldLog(level) {
  return LOG_LEVELS[level] <= configuredLevel();
}

function write(level, message, meta) {
  if (!shouldLog(level)) {
    return;
  }
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${redactText(message)}`;
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (meta === undefined) {
    sink(line);
    return;
  }
  sink(line, redactText(serializeMeta(meta)));
}

function serializeMeta(meta) {
  if (meta instanceof Error) {
    return `${meta.name}: ${meta.message}`;
  }
  if (typeof meta === 'string') {
    return meta;
  }
  try {
    return JSON.stringify(scrubMeta(meta));
  } catch {
    return '[unserializable meta]';
  }
}

const ID_IN_STRING_PATTERN = /\b(?:user|session|msg)_[A-Za-z0-9-]{4,}\b/g;

// Any meta value that looks like an identifier is replaced with its pseudonym so
// raw user/session ids never reach the log sink.
function scrubMeta(meta) {
  if (!meta || typeof meta !== 'object') {
    return meta;
  }
  return Object.fromEntries(
    Object.entries(meta).map(([key, value]) => {
      if (typeof value === 'string') {
        return [key, value.replace(ID_IN_STRING_PATTERN, (match) => pseudonymize(match))];
      }
      return [key, value];
    })
  );
}

export const logger = {
  error: (message, meta) => write('error', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  info: (message, meta) => write('info', message, meta),
  debug: (message, meta) => write('debug', message, meta),
};

export function logSecurityEvent(event, req, meta) {
  logger.warn(`security_event=${event}`, {
    ip: req?.ip,
    method: req?.method,
    url: redactUrl(req?.originalUrl || ''),
    ...meta,
  });
}
