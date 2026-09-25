import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampTrustScore,
  computeActionTrustDelta,
  computeChatTrustDelta,
  getTrustPhase,
  hasCrisisFlag,
} from '../utils/trustScore.js';
import { TRUST_DELTAS, TRUST_PHASES } from '../config/constants.js';

test('getTrustPhase matches the three documented bands', () => {
  assert.equal(getTrustPhase(0), TRUST_PHASES.LISTENING);
  assert.equal(getTrustPhase(39), TRUST_PHASES.LISTENING);
  assert.equal(getTrustPhase(40), TRUST_PHASES.MOMENTUM);
  assert.equal(getTrustPhase(69), TRUST_PHASES.MOMENTUM);
  assert.equal(getTrustPhase(70), TRUST_PHASES.ACCOUNTABILITY);
  assert.equal(getTrustPhase(100), TRUST_PHASES.ACCOUNTABILITY);
});

test('clampTrustScore bounds and rounds values', () => {
  assert.equal(clampTrustScore(-50), 0);
  assert.equal(clampTrustScore(1000), 100);
  assert.equal(clampTrustScore(63.4), 63);
  assert.equal(clampTrustScore('72'), 72);
  assert.equal(clampTrustScore('not-a-number'), 0);
});

test('computeChatTrustDelta rewards a supportive reply that offers a tiny action', () => {
  assert.equal(computeChatTrustDelta({}), TRUST_DELTAS.CHAT_INTERACTION);
  assert.equal(
    computeChatTrustDelta({ tinyAction: 'Take three slow breaths.' }),
    TRUST_DELTAS.CHAT_INTERACTION + TRUST_DELTAS.CHAT_TINY_ACTION
  );
  assert.equal(computeChatTrustDelta({ tinyAction: '   ' }), TRUST_DELTAS.CHAT_INTERACTION);
});

test('computeChatTrustDelta never rewards a crisis turn', () => {
  assert.equal(
    computeChatTrustDelta({ riskFlags: ['CRISIS_DETECTED'], tinyAction: 'Call someone' }),
    TRUST_DELTAS.CRISIS_DETECTED
  );
});

test('computeActionTrustDelta is derived from completion only', () => {
  assert.equal(computeActionTrustDelta({ completed: true }), TRUST_DELTAS.ACTION_COMPLETED);
  assert.equal(computeActionTrustDelta({ completed: false }), TRUST_DELTAS.ACTION_DECLINED);
  assert.equal(computeActionTrustDelta({}), TRUST_DELTAS.ACTION_DECLINED);
});

test('a single chat turn can never move the score to an extreme', () => {
  const startingScore = 50;
  assert.ok(startingScore + computeChatTrustDelta({ tinyAction: 'x' }) < 100);
  assert.ok(startingScore + computeChatTrustDelta({ riskFlags: ['CRISIS_DETECTED'] }) > 0);
});

test('hasCrisisFlag only matches the crisis flag in an array', () => {
  assert.equal(hasCrisisFlag(['CRISIS_DETECTED']), true);
  assert.equal(hasCrisisFlag(['FALLBACK_ACTIVE']), false);
  assert.equal(hasCrisisFlag(null), false);
  assert.equal(hasCrisisFlag('CRISIS_DETECTED'), false);
});
