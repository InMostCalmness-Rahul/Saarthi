import { createHmac, timingSafeEqual } from 'node:crypto';

// Compact, dependency-free signed token: "<version>.<base64url(payload)>.<base64url(hmac)>".
// The payload is not encrypted (it only holds an opaque server-minted user id),
// but it is integrity protected, so a client cannot mint or tamper with an identity.
const TOKEN_VERSION = 'v1';
const HMAC_ALGORITHM = 'sha256';

function encode(value) {
  return Buffer.from(value).toString('base64url');
}

function decode(value) {
  return Buffer.from(value, 'base64url');
}

function sign(encodedPayload, secret) {
  return createHmac(HMAC_ALGORITHM, secret).update(encodedPayload).digest();
}

export function createToken({ subject, secret, ttlMs }) {
  if (typeof subject !== 'string' || subject.length === 0) {
    throw new TypeError('createToken requires a non-empty subject');
  }
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new TypeError('createToken requires a non-empty secret');
  }

  const issuedAt = Date.now();
  const payload = {
    sub: subject,
    iat: issuedAt,
    exp: issuedAt + ttlMs,
  };

  const encodedPayload = encode(JSON.stringify(payload));
  const signature = encode(sign(encodedPayload, secret));

  return {
    token: `${TOKEN_VERSION}.${encodedPayload}.${signature}`,
    expiresAt: new Date(payload.exp).toISOString(),
  };
}

export function verifyToken(token, secret) {
  if (typeof token !== 'string' || typeof secret !== 'string' || secret.length === 0) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) {
    return null;
  }

  const [, encodedPayload, encodedSignature] = parts;
  const expectedSignature = sign(encodedPayload, secret);

  let providedSignature;
  try {
    providedSignature = decode(encodedSignature);
  } catch {
    return null;
  }

  if (
    providedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(providedSignature, expectedSignature)
  ) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(decode(encodedPayload).toString('utf8'));
  } catch {
    return null;
  }

  if (!payload || typeof payload.sub !== 'string' || typeof payload.exp !== 'number') {
    return null;
  }

  if (Date.now() >= payload.exp) {
    return null;
  }

  return payload;
}

export function extractBearerToken(headerValue) {
  if (typeof headerValue !== 'string') {
    return null;
  }
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
