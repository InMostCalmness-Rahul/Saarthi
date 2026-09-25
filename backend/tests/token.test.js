import test from 'node:test';
import assert from 'node:assert/strict';
import { createToken, extractBearerToken, verifyToken } from '../utils/token.js';

const SECRET = 'unit-test-secret-with-plenty-of-entropy-0123456789';

test('createToken -> verifyToken round trips the subject', () => {
  const { token, expiresAt } = createToken({ subject: 'user_abc123', secret: SECRET, ttlMs: 60_000 });

  const payload = verifyToken(token, SECRET);
  assert.equal(payload.sub, 'user_abc123');
  assert.ok(Date.parse(expiresAt) > Date.now(), 'expiresAt should be in the future');
});

test('verifyToken rejects a forged payload that reuses a valid signature', () => {
  const { token } = createToken({ subject: 'user_real', secret: SECRET, ttlMs: 60_000 });
  const [version, , signature] = token.split('.');
  const forgedPayload = Buffer.from(
    JSON.stringify({ sub: 'user_victim', iat: Date.now(), exp: Date.now() + 60_000 })
  ).toString('base64url');

  assert.equal(verifyToken(`${version}.${forgedPayload}.${signature}`, SECRET), null);
});

test('verifyToken rejects a token signed with a different secret', () => {
  const { token } = createToken({ subject: 'user_abc123', secret: SECRET, ttlMs: 60_000 });
  assert.equal(verifyToken(token, 'another-secret-that-is-long-enough-1234567890'), null);
});

test('verifyToken rejects expired tokens', () => {
  const { token } = createToken({ subject: 'user_abc123', secret: SECRET, ttlMs: -1000 });
  assert.equal(verifyToken(token, SECRET), null);
});

test('verifyToken rejects malformed input', () => {
  assert.equal(verifyToken('', SECRET), null);
  assert.equal(verifyToken('not-a-token', SECRET), null);
  assert.equal(verifyToken('v1.only-two-parts', SECRET), null);
  assert.equal(verifyToken(null, SECRET), null);
  assert.equal(verifyToken('v1.abc.def', ''), null);
});

test('createToken validates its inputs', () => {
  assert.throws(() => createToken({ subject: '', secret: SECRET, ttlMs: 1000 }), TypeError);
  assert.throws(() => createToken({ subject: 'user_a', secret: '', ttlMs: 1000 }), TypeError);
});

test('extractBearerToken parses only bearer headers', () => {
  assert.equal(extractBearerToken('Bearer abc.def.ghi'), 'abc.def.ghi');
  assert.equal(extractBearerToken('bearer token-value'), 'token-value');
  assert.equal(extractBearerToken('Basic abc'), null);
  assert.equal(extractBearerToken(undefined), null);
});
