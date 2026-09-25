import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCrisisResponse,
  buildFallbackResponse,
  firstSentence,
  normalizeAiResponse,
  normalizeRiskFlags,
  trailingQuestion,
} from '../services/aiService.js';
import { RISK_FLAGS } from '../config/constants.js';
import { CRISIS_REPLY } from '../utils/crisisDetection.js';

test('normalizeAiResponse keeps structured fields from the AI service', () => {
  const normalized = normalizeAiResponse({
    content: 'That sounds heavy. What happened today?',
    emotional_validation: 'That sounds heavy.',
    reconnection_nudge: 'Maybe text a friend?',
    tiny_action: 'Drink a glass of water.',
    followup_question: 'What happened today?',
    risk_flags: ['crisis_detected', 'crisis_detected', 'fallback_active'],
  });

  assert.equal(normalized.content, 'That sounds heavy. What happened today?');
  assert.equal(normalized.emotional_validation, 'That sounds heavy.');
  assert.equal(normalized.reconnection_nudge, 'Maybe text a friend?');
  assert.equal(normalized.tiny_action, 'Drink a glass of water.');
  assert.equal(normalized.followup_question, 'What happened today?');
  assert.deepEqual(normalized.risk_flags, ['CRISIS_DETECTED', 'FALLBACK_ACTIVE']);
});

test('normalizeAiResponse falls back to heuristics for a bare string', () => {
  const normalized = normalizeAiResponse('I hear you. That sounds hard. What feels heaviest right now?');

  assert.equal(normalized.content, 'I hear you. That sounds hard. What feels heaviest right now?');
  assert.equal(normalized.emotional_validation, 'I hear you.');
  assert.equal(normalized.followup_question, 'What feels heaviest right now?');
  assert.equal(normalized.tiny_action, null);
  assert.deepEqual(normalized.risk_flags, []);
});

test('normalizeAiResponse coerces garbage input instead of throwing', () => {
  for (const input of [null, undefined, 42, [], { text: 'only text' }]) {
    const normalized = normalizeAiResponse(input);
    assert.equal(typeof normalized.content, 'string');
    assert.ok(Array.isArray(normalized.risk_flags));
  }
});

test('normalizeRiskFlags drops non-strings and caps the list', () => {
  assert.deepEqual(normalizeRiskFlags('CRISIS_DETECTED'), []);
  assert.deepEqual(normalizeRiskFlags([1, null, ' ok ']), ['OK']);
  assert.equal(normalizeRiskFlags(new Array(30).fill('X')).length, 1);
});

test('firstSentence and trailingQuestion behave on edge cases', () => {
  assert.equal(firstSentence(null), null);
  assert.equal(firstSentence(''), null);
  assert.equal(firstSentence('No terminator here'), 'No terminator here');
  assert.equal(trailingQuestion('No question at all.'), null);
  assert.equal(trailingQuestion('Ready? Not yet? Yes?'), 'Yes?');
});

test('buildCrisisResponse always carries the crisis flag and human-help content', () => {
  const response = buildCrisisResponse();
  assert.ok(response.risk_flags.includes(RISK_FLAGS.CRISIS_DETECTED));
  assert.equal(response.content, CRISIS_REPLY);
  assert.equal(response.tiny_action, null);
});

test('the AI outage fallback is crisis-aware (regression: it had no crisis branch)', () => {
  const crisis = buildFallbackResponse('I want to die');
  assert.ok(crisis.risk_flags.includes(RISK_FLAGS.CRISIS_DETECTED));
  assert.equal(crisis.content, CRISIS_REPLY);

  const ordinary = buildFallbackResponse('Work has been overwhelming this week');
  assert.ok(ordinary.risk_flags.includes(RISK_FLAGS.FALLBACK_ACTIVE));
  assert.ok(!ordinary.risk_flags.includes(RISK_FLAGS.CRISIS_DETECTED));
  assert.match(ordinary.content, /trouble reaching my language model/);
});
