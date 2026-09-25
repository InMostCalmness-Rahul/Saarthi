import test from 'node:test';
import assert from 'node:assert/strict';
import {
  requestValidator,
  validateActionUpdate,
  validateChatMessage,
  validatePreferencesUpdate,
} from '../middleware/validation.js';

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function run(middleware, req) {
  const res = createRes();
  let nextCalled = false;
  middleware(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
}

function jsonReq(body) {
  return { method: 'POST', body, headers: {}, is: () => true };
}

test('validateChatMessage accepts a valid message', () => {
  const { nextCalled } = run(validateChatMessage, jsonReq({ message: 'I feel stuck today' }));
  assert.equal(nextCalled, true);
});

test('validateChatMessage rejects empty, whitespace and oversized messages', () => {
  assert.equal(run(validateChatMessage, jsonReq({})).res.statusCode, 400);
  assert.equal(run(validateChatMessage, jsonReq({ message: '' })).res.statusCode, 400);
  assert.equal(run(validateChatMessage, jsonReq({ message: '   ' })).res.statusCode, 400);
  assert.equal(run(validateChatMessage, jsonReq({ message: 42 })).res.statusCode, 400);
  assert.equal(
    run(validateChatMessage, jsonReq({ message: 'a'.repeat(4001) })).res.statusCode,
    400
  );
});

test('validateChatMessage rejects a malformed sessionId', () => {
  const { res, nextCalled } = run(
    validateChatMessage,
    jsonReq({ message: 'hello', sessionId: '../../../etc/passwd' })
  );
  assert.equal(res.statusCode, 400);
  assert.equal(nextCalled, false);
});

test('validateChatMessage does not require a client-supplied userId', () => {
  const { nextCalled } = run(validateChatMessage, jsonReq({ message: 'hi' }));
  assert.equal(nextCalled, true);
});

test('validateActionUpdate requires an explicit boolean completion', () => {
  assert.equal(run(validateActionUpdate, jsonReq({ actionCommitment: 'Text a friend' })).res.statusCode, 400);
  assert.equal(
    run(validateActionUpdate, jsonReq({ actionCommitment: 'Text a friend', completed: 'yes' })).res
      .statusCode,
    400
  );
  assert.equal(
    run(validateActionUpdate, jsonReq({ actionCommitment: '', completed: true })).res.statusCode,
    400
  );
  assert.equal(
    run(validateActionUpdate, jsonReq({ actionCommitment: 'Text a friend', completed: true }))
      .nextCalled,
    true
  );
});

test('validateActionUpdate rejects any client-supplied trustScoreDelta (regression)', () => {
  for (const trustScoreDelta of [100, -100, 0, 3.5, '100']) {
    const { res, nextCalled } = run(
      validateActionUpdate,
      jsonReq({ actionCommitment: 'Text a friend', completed: true, trustScoreDelta })
    );
    assert.equal(res.statusCode, 400, `delta ${trustScoreDelta} must be rejected`);
    assert.equal(nextCalled, false);
    assert.match(res.body.error.message, /trustScoreDelta/);
  }
});

test('validateActionUpdate rejects an oversized action commitment', () => {
  const { res } = run(
    validateActionUpdate,
    jsonReq({ actionCommitment: 'a'.repeat(281), completed: false })
  );
  assert.equal(res.statusCode, 400);
});

test('validatePreferencesUpdate requires a boolean', () => {
  assert.equal(run(validatePreferencesUpdate, jsonReq({ proactiveNudgesConsent: 'true' })).res.statusCode, 400);
  assert.equal(run(validatePreferencesUpdate, jsonReq({})).res.statusCode, 400);
  assert.equal(
    run(validatePreferencesUpdate, jsonReq({ proactiveNudgesConsent: false })).nextCalled,
    true
  );
});

test('requestValidator enforces a JSON content type when a body is present', () => {
  const req = {
    method: 'POST',
    path: '/api/chat',
    headers: { 'content-length': '12' },
    is: () => false,
  };
  const { res, nextCalled } = run(requestValidator, req);
  assert.equal(res.statusCode, 400);
  assert.equal(nextCalled, false);
});

test('requestValidator allows GET requests without a content type', () => {
  const req = { method: 'GET', path: '/api/trust-score', headers: {}, is: () => false };
  const { nextCalled } = run(requestValidator, req);
  assert.equal(nextCalled, true);
});
