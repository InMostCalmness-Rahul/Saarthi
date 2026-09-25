// Smoke test for the backend.
// Verifies the authenticated chat flow AND the two safety-critical regressions:
//   1. anonymous access to user-scoped endpoints is rejected
//   2. crisis handling works even when it cannot depend on the model
//
// Run after starting backend + ai_service (and with MongoDB reachable):
//   npm run test:smoke-chat

import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000';

function fail(message) {
  throw new Error(message);
}

async function main() {
  // 1. Anonymous access must be refused.
  try {
    await axios.post(`${BACKEND_URL}/api/chat`, { message: 'hello' }, { timeout: 10000 });
    fail('Expected /api/chat to reject an anonymous request');
  } catch (error) {
    if (error.response?.status !== 401) {
      fail(`Expected 401 for an anonymous /api/chat call, got ${error.response?.status ?? error.message}`);
    }
    console.log('Anonymous request correctly rejected with 401');
  }

  // 2. Mint a server-side identity.
  const sessionResponse = await axios.post(
    `${BACKEND_URL}/api/auth/session`,
    {},
    { timeout: 10000, headers: { 'Content-Type': 'application/json' } }
  );

  const { token, userId, trustScore } = sessionResponse.data?.data ?? {};
  if (!token || !userId) {
    fail('Session endpoint did not return a token and userId');
  }
  if (typeof trustScore !== 'number') {
    fail('Session endpoint did not return a numeric trustScore');
  }

  const authed = { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
  console.log(`Minted session for ${userId} (trust ${trustScore})`);

  // 3. Normal chat turn.
  const chatResponse = await axios.post(
    `${BACKEND_URL}/api/chat`,
    { message: "I'm feeling anxious about a presentation next week." },
    { ...authed, timeout: 15000 }
  );

  const chat = chatResponse.data;
  if (chat?.success !== true || !chat.data?.botResponse?.content) {
    fail('Chat response did not contain bot content');
  }
  if (typeof chat.data.trustScore !== 'number' || typeof chat.data.sessionId !== 'string') {
    fail('Chat response is missing trustScore/sessionId');
  }
  console.log(`Chat OK (trust ${trustScore} -> ${chat.data.trustScore})`);

  // 4. Crisis safety path (must not depend on the AI service being up).
  const crisisResponse = await axios.post(
    `${BACKEND_URL}/api/chat`,
    { message: 'I want to die' },
    { ...authed, timeout: 15000 }
  );

  const crisisData = crisisResponse.data?.data;
  if (!crisisData?.botResponse?.risk_flags?.includes('CRISIS_DETECTED')) {
    fail('Crisis message was not flagged with CRISIS_DETECTED');
  }
  if (crisisData.trustScore >= chat.data.trustScore) {
    fail('Crisis turn must not increase the trust score');
  }
  console.log('Crisis handling OK (CRISIS_DETECTED, trust decreased)');

  // 5. Clean up the smoke-test identity.
  await axios.delete(`${BACKEND_URL}/api/user-data`, { ...authed, timeout: 10000 });
  console.log('Smoke test passed');
}

main().catch((error) => {
  console.error('Backend smoke test failed:', error.message);
  if (error.response) {
    console.error('Response data:', JSON.stringify(error.response.data));
  }
  process.exitCode = 1;
});
