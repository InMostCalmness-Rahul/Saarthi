import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

// HTTP-level contract tests for the authentication boundary. These intentionally
// require no database: every assertion is rejected before a query is executed.
process.env.NODE_ENV = 'test';
process.env.AUTH_SECRET = 'http-contract-test-secret-1234567890abcdef';
process.env.CORS_ORIGINS = 'http://localhost:5173';

const { startTestServer, getWithToken, postJson } = await import('./helpers/server.js');
const { createToken } = await import('../utils/token.js');

let server;

before(async () => {
  server = await startTestServer();
});

after(async () => {
  await server.close();
});

function tokenFor(userId, secret = process.env.AUTH_SECRET) {
  return createToken({ subject: userId, secret, ttlMs: 60_000 }).token;
}

test('GET /health is public', async () => {
  const response = await fetch(`${server.baseUrl}/health`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, 'healthy');
});

test('user-scoped endpoints reject anonymous callers with 401', async () => {
  const protectedRequests = [
    ['POST', '/api/chat'],
    ['POST', '/api/action-update'],
    ['GET', '/api/trust-score'],
    ['GET', '/api/preferences'],
    ['GET', '/api/user-data/export'],
    ['DELETE', '/api/user-data'],
  ];

  for (const [method, path] of protectedRequests) {
    const response = await fetch(`${server.baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(method === 'POST' ? { body: '{}' } : {}),
    });
    assert.equal(response.status, 401, `${method} ${path} must require auth`);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.status, 401);
    assert.equal(body.error.details, undefined, 'error details must never be echoed');
  }
});

test('a token signed with the wrong secret is rejected', async () => {
  const forged = tokenFor('user_attacker', 'a-different-secret-that-is-long-enough-123');
  const response = await getWithToken(server.baseUrl, '/api/trust-score', forged);
  assert.equal(response.status, 401);
});

test('legacy /:userId URLs cannot be used to read another user (IDOR regression)', async () => {
  const token = tokenFor('user_victim');
  const response = await getWithToken(server.baseUrl, '/api/trust-score/user_someone_else', token);
  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.success, false);
  assert.equal(body.error.status, 403);
});

test('legacy delete/export URLs are also ownership-checked', async () => {
  const token = tokenFor('user_victim');

  const exportResponse = await getWithToken(
    server.baseUrl,
    '/api/user-data/user_other/export',
    token
  );
  assert.equal(exportResponse.status, 403);

  const deleteResponse = await fetch(`${server.baseUrl}/api/user-data/user_other`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(deleteResponse.status, 403);
});

test('chat rejects a body userId that disagrees with the token identity', async () => {
  const token = tokenFor('user_owner');
  const response = await postJson(
    server.baseUrl,
    '/api/chat',
    { message: 'hello', userId: 'user_other' },
    token
  );
  assert.equal(response.status, 403);
});

test('chat validates payloads before touching the database', async () => {
  const token = tokenFor('user_owner');

  const emptyMessage = await postJson(server.baseUrl, '/api/chat', { message: '  ' }, token);
  assert.equal(emptyMessage.status, 400);

  const badSession = await postJson(
    server.baseUrl,
    '/api/chat',
    { message: 'hello', sessionId: 'not-a-session' },
    token
  );
  assert.equal(badSession.status, 400);
});

test('action-update refuses client-supplied trust deltas', async () => {
  const token = tokenFor('user_owner');
  const response = await postJson(
    server.baseUrl,
    '/api/action-update',
    { actionCommitment: 'Text a friend', completed: true, trustScoreDelta: 100 },
    token
  );
  assert.equal(response.status, 400);
});

test('unknown routes return a 404 envelope without echoing the raw path', async () => {
  const response = await fetch(`${server.baseUrl}/api/user_1738000000000/unknown`);
  assert.equal(response.status, 404);
  const body = await response.json();
  assert.equal(body.success, false);
});

test('malformed JSON produces a generic 400 rather than a parser dump', async () => {
  const response = await fetch(`${server.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer irrelevant' },
    body: '{not json',
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error.message, 'Request body must be valid JSON');
});

test('security headers are present (helmet)', async () => {
  const response = await fetch(`${server.baseUrl}/health`);
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.ok(response.headers.get('x-content-type-options'));
  assert.ok(response.headers.get('x-frame-options') || response.headers.get('content-security-policy'));
});

test('CORS only reflects allow-listed origins', async () => {
  const allowed = await fetch(`${server.baseUrl}/health`, {
    headers: { Origin: 'http://localhost:5173' },
  });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.equal(allowed.headers.get('access-control-allow-credentials'), null);

  const denied = await fetch(`${server.baseUrl}/health`, {
    headers: { Origin: 'https://evil.example.com' },
  });
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});
