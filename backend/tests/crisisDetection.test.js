import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CRISIS_REPLY,
  collapseSpacedLetters,
  detectCrisis,
  normalizeForDetection,
} from '../utils/crisisDetection.js';

const highRiskCases = [
  'I want to die',
  'I wanna die most days',
  "I've been thinking about suicide",
  'I am going to kill myself',
  'I keep cutting myself when it gets bad',
  'I want to end my life',
  "I'd be better off dead",
  'Sometimes I feel like I am not worth living',
  'I want to end it all',
  'honestly I want to kms',
  'please stop saying kys to me',
  'I have been planning to off myself',
  'I took my own life last year',
  'i want 2 die',
  'I am thinking about s u i c i d e',
];

for (const message of highRiskCases) {
  test(`detects high risk: "${message}"`, () => {
    const result = detectCrisis(message);
    assert.equal(result.hasRisk, true);
    assert.equal(result.riskLevel, 'high');
    assert.ok(result.keywords.length > 0);
  });
}

test('detects obfuscated leetspeak and punctuation', () => {
  assert.equal(detectCrisis('i want to d1e').hasRisk, true);
  assert.equal(detectCrisis('kill.myself tonight').hasRisk, true);
  assert.equal(detectCrisis('k i l l m y s e l f').hasRisk, true);
});

const moderateRiskCases = [
  'I cannot go on like this anymore',
  'I do not want to be here anymore',
  'I wish I was dead',
  'Nobody would care if I was gone',
  'I feel like a burden to everyone',
];

for (const message of moderateRiskCases) {
  test(`detects moderate risk: "${message}"`, () => {
    const result = detectCrisis(message);
    assert.equal(result.hasRisk, true);
    assert.equal(result.riskLevel, 'moderate');
  });
}

const benignCases = ["Let's end it there for today", 'I will end it tomorrow morning at work'];

test('does not escalate benign text that previously false-positived on "end it"', () => {
  for (const message of benignCases) {
    assert.equal(detectCrisis(message).hasRisk, false, `expected benign: "${message}"`);
  }
});

// Deliberate fail-safe trade-off: the literal words "suicide" / "kys" escalate even
// in third-person or educational contexts. Over-escalating costs a supportive
// message; under-escalating is a safety failure.
test('escalates literal risk vocabulary even in third-person contexts (fail-safe)', () => {
  assert.equal(detectCrisis('My friend keeps joking about kys, I am safe').riskLevel, 'high');
  assert.equal(detectCrisis('Suicide prevention training was part of onboarding').riskLevel, 'high');
  assert.equal(
    detectCrisis('My brother attempted suicide last year and I am scared').riskLevel,
    'high'
  );
});

test('does not flag ordinary distress without risk language', () => {
  assert.equal(detectCrisis('I am exhausted after a long week').hasRisk, false);
  assert.equal(detectCrisis('Work is stressful but I am managing').hasRisk, false);
  assert.equal(detectCrisis('').hasRisk, false);
  assert.equal(detectCrisis(null).hasRisk, false);
  assert.equal(detectCrisis(undefined).hasRisk, false);
});

test('benignCases list stays non-escalating', () => {
  for (const message of benignCases) {
    assert.equal(detectCrisis(message).hasRisk, false, `expected benign: "${message}"`);
  }
});

test('normalizeForDetection expands leetspeak, punctuation and spaced letters', () => {
  assert.equal(normalizeForDetection('K1LL   MYSELF!!'), 'kill myself');
  assert.equal(normalizeForDetection('k i l l  m y s e l f'), 'killmyself');
  assert.equal(normalizeForDetection(''), '');
  assert.equal(normalizeForDetection(null), '');
});

test('collapseSpacedLetters only collapses runs of single letters', () => {
  assert.equal(collapseSpacedLetters('k i l l'), 'kill');
  assert.equal(collapseSpacedLetters('skill metering'), 'skill metering');
});

test('the shared crisis reply points to human help', () => {
  assert.match(CRISIS_REPLY, /crisis line|emergency/i);
  assert.match(CRISIS_REPLY, /findahelpline\.com/);
  assert.match(CRISIS_REPLY, /988/);
});
