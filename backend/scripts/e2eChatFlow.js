// End-to-end API flow for the authenticated Saarthi backend.
// Covers: session minting -> chat -> trust score -> action update -> privacy
// export/delete, plus explicit IDOR and session-hijack regression checks.
//
// Usage: start the backend (npm run dev) and run `npm run test:e2e-chat`.

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000';

async function apiFetch(url, options = {}) {
  try {
    return await fetch(url, options);
  } catch (error) {
    const details = error?.cause?.message || error.message;
    throw new Error(
      `Could not reach backend at ${BACKEND_URL}. Start backend with "npm run dev" before running this test. (${details})`
    );
  }
}

async function jsonBody(response) {
  const body = await response.json().catch(() => null);
  if (!body) {
    throw new Error(`Expected JSON body from ${response.url} (status ${response.status})`);
  }
  return body;
}

function authHeaders(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function mintSession() {
  const response = await apiFetch(`${BACKEND_URL}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert(response.status === 201, `Session mint failed with ${response.status}`);
  const { token, userId, trustScore } = (await jsonBody(response)).data;
  assert(typeof token === 'string' && typeof userId === 'string', 'Session payload missing token/userId');
  return { token, userId, trustScore };
}

async function run() {
  console.log('Running Saarthi E2E chat flow...');

  // 1. Anonymous access is rejected.
  const anonymous = await apiFetch(`${BACKEND_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'hello' }),
  });
  assert(anonymous.status === 401, `Expected 401 for anonymous /api/chat, got ${anonymous.status}`);
  console.log('Anonymous /api/chat rejected with 401');

  // 2. Mint a server-side identity (clients can no longer choose a userId).
  const { token, userId, trustScore: initialTrust } = await mintSession();
  const headers = authHeaders(token);
  const sessionId = `session_e2e-${Date.now()}`;
  console.log(`Session OK for ${userId} (trust ${initialTrust})`);

  // 3. Chat turn.
  const chatResponse = await apiFetch(`${BACKEND_URL}/api/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message: 'I feel overwhelmed and need a small next step.', sessionId }),
  });
  assert(chatResponse.ok, `Chat request failed with status ${chatResponse.status}`);
  const chatResult = await jsonBody(chatResponse);
  assert(chatResult.success && chatResult.data?.botResponse?.content, 'Chat payload missing bot response');
  assert(chatResult.data.sessionId === sessionId, 'Chat did not echo the owned sessionId');
  console.log('Chat endpoint OK');

  // 4. Trust score.
  const trustResponse = await apiFetch(`${BACKEND_URL}/api/trust-score`, { headers });
  assert(trustResponse.ok, `Trust score request failed with status ${trustResponse.status}`);
  const trustResult = await jsonBody(trustResponse);
  assert(typeof trustResult.data?.trustScore === 'number', 'Trust payload missing numeric trustScore');
  console.log('Trust score endpoint OK');

  // 5. Action commitment: client-supplied deltas are rejected, server derives +4.
  const rejectedDelta = await apiFetch(`${BACKEND_URL}/api/action-update`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      actionCommitment: 'Send one text to a friend',
      completed: true,
      trustScoreDelta: 100,
    }),
  });
  assert(rejectedDelta.status === 400, `Client trustScoreDelta must be rejected, got ${rejectedDelta.status}`);

  const actionResponse = await apiFetch(`${BACKEND_URL}/api/action-update`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ actionCommitment: 'Send one text to a friend', completed: true, sessionId }),
  });
  assert(actionResponse.ok, `Action update failed with status ${actionResponse.status}`);
  const actionResult = await jsonBody(actionResponse);
  assert(actionResult.data?.trustScoreDelta === 4, 'Expected a server-derived +4 delta');
  console.log('Action update endpoint OK');

  // 6. IDOR regression: another user's data must not be readable.
  const idor = await apiFetch(`${BACKEND_URL}/api/user-data/user_someone_else/export`, { headers });
  assert(idor.status === 403, `Expected 403 for another user's export, got ${idor.status}`);
  console.log('Ownership enforcement OK (403 for another user)');

  // 7. Session hijack regression: a session owned by someone else is refused.
  const secondSession = await mintSession();
  const hijack = await apiFetch(`${BACKEND_URL}/api/chat`, {
    method: 'POST',
    headers: authHeaders(secondSession.token),
    body: JSON.stringify({ message: 'hijack attempt', sessionId }),
  });
  assert(hijack.status === 409, `Expected 409 when reusing another user's sessionId, got ${hijack.status}`);
  console.log('Session hijack prevention OK (409)');

  // 8. Export then delete.
  const exportResponse = await apiFetch(`${BACKEND_URL}/api/user-data/export`, { headers });
  assert(exportResponse.ok, `Export request failed with status ${exportResponse.status}`);
  const exportResult = await jsonBody(exportResponse);
  assert(
    Array.isArray(exportResult.data?.messages) && exportResult.data.messages.length > 0,
    'Export payload missing messages'
  );
  console.log('Data export endpoint OK');

  const deleteResponse = await apiFetch(`${BACKEND_URL}/api/user-data`, { method: 'DELETE', headers });
  assert(deleteResponse.ok, `Delete request failed with status ${deleteResponse.status}`);
  console.log('Data delete endpoint OK');

  const afterDelete = await jsonBody(await apiFetch(`${BACKEND_URL}/api/trust-score`, { headers }));
  assert(afterDelete.data.trustScore === 50, 'Deleted user should fall back to the default trust score');
  console.log('Post-delete state OK');

  console.log('E2E flow passed successfully');
}

run().catch((error) => {
  console.error('E2E flow failed:', error.message);
  process.exit(1);
});
