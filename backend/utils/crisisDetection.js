import { RISK_FLAGS } from '../config/constants.js';

// Crisis handling must NOT depend on the conversational model being reachable.
// This module is the single detection entry point, used by the chat controller
// (before any AI call) and by the AI-service fallback path.
//
// Detection is layered:
//   1. normalise  -> case, leetspeak, punctuation, spaced-out letters
//   2. explicit self-harm / suicide phrases                  -> "high"
//   3. ambiguous distress phrases that need self-reference    -> "moderate"
//
// Deliberately NOT included: a bare "end it". It fired on benign text such as
// "let's end it there" or "I'll end it tomorrow"; only "end it all" (a much more
// specific signal) is escalated.

const LEET_MAP = {
  0: 'o',
  1: 'i',
  3: 'e',
  4: 'a',
  5: 's',
  6: 'g',
  7: 't',
  8: 'b',
  9: 'g',
  '@': 'a',
  $: 's',
  '|': 'i',
};

const HIGH_RISK_PATTERNS = [
  /\bsuicid(?:e|al)\b/,
  /\b(?:commit|committing|attempt|attempting|attempted)\s+suicide\b/,
  /\b(?:kill|killing)\s+(?:myself|me)\b/,
  /\bi\s+(?:want|wanna|wish)\s+(?:to\s+|2\s+)?(?:die|be\s+dead)\b/,
  /\b(?:rather|better)\s+off\s+dead\b/,
  /\bnot\s+worth\s+living\b/,
  /\b(?:no|zero)\s+(?:reason|point)\s+(?:to|in)\s+liv(?:e|ing)\b/,
  /\bend\s+my\s+life\b/,
  /\b(?:take|taking|took)\s+my\s+(?:own\s+)?life\b/,
  /\b(?:want|plan|planning|going|ready)\s+to\s+end\s+it\s+all\b/,
  /\bself\s*-?\s*(?:harm|harming|hurt|injury|mutilation)\b/,
  /\b(?:harm|hurt|cut|cutting|injure|injuring)\s+myself\b/,
  /\bcut\s+my\s+(?:body|wrist|wrists|arm|arms|thigh|legs)\b/,
  /\boverdos(?:e|ing|ed)\b/,
  /\bsuicide\s+(?:note|plan|method|attempt)\b/,
  /\b(?:kms|kys|kysmt)\b/,
  /\boff\s+myself\b/,
  /\bunalive\s+myself\b/,
  /\b(?:hang|hanging)\s+myself\b/,
  /\bgoodbye\s+forever\b/,
  /\bthis\s+is\s+my\s+(?:last|final)\s+(?:message|goodbye|note)\b/,
];

const AMBIGUOUS_RISK_PATTERNS = [
  /\b(?:can'?t|cannot|can\s+not)\s+(?:go\s+on|do\s+this\s+anymore|keep\s+going|take\s+(?:it|this)\s+anymore)\b/,
  /\b(?:do\s+not|don'?t)\s+want\s+to\s+(?:be\s+here|wake\s+up|exist|live)\b/,
  /\bwish\s+i\s+(?:was|were)\s+(?:dead|gone|never\s+born)\b/,
  /\b(?:nobody|no\s+one)\s+would\s+(?:care|notice|miss\s+me)\b/,
  /\bdisappear\s+forever\b/,
  /\b(?:feel|feeling|am|being)\s+(?:like\s+)?(?:a\s+)?burden\b/,
  /\bwouldn'?t\s+miss\s+me\b/,
];

// Applied only when the message contained spaced-out letters (obfuscation), which
// is why plain substrings are acceptable here: "skill metering" never triggers
// this path because it is not spaced out.
const OBFUSCATED_COMPACT_PHRASES = [
  'killmyself',
  'killingmyself',
  'wanttodie',
  'wannadie',
  'wishtodie',
  'endmylife',
  'enditall',
  'takemylife',
  'takemyownlife',
  'betteroffdead',
  'notworthliving',
  'offmyself',
  'unalivemyself',
  'hangmyself',
  'cutmyself',
  'hurtmyself',
  'harmmyself',
];

const SELF_REFERENCE_PATTERNS = [/\bi\b/, /\bme\b/, /\bmy\b/, /\bmyself\b/, /\bi'?m\b/, /\bi'?ve\b/];

const SPACED_LETTERS_PATTERN = /\b(?:[a-z]\s+){2,}[a-z]\b/g;

export function collapseSpacedLetters(text) {
  return text.replace(SPACED_LETTERS_PATTERN, (match) => match.replace(/\s+/g, ''));
}

export function normalizeForDetection(text) {
  if (typeof text !== 'string') {
    return '';
  }

  const lowered = text.toLowerCase().replace(/[\u2018\u2019]/g, "'");
  const deleeted = lowered
    .split('')
    .map((char) => LEET_MAP[char] ?? char)
    .join('');

  const collapsed = collapseSpacedLetters(deleeted);
  const punctuationToSpace = collapsed.replace(/[^a-z0-9'\s]/g, ' ');

  return punctuationToSpace.replace(/\s+/g, ' ').trim();
}

function collectMatches(normalized, patterns) {
  return patterns.filter((pattern) => pattern.test(normalized)).map((pattern) => pattern.source);
}

function hasSelfReference(normalized) {
  return SELF_REFERENCE_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * @returns {{ hasRisk: boolean, riskLevel: 'none'|'moderate'|'high', keywords: string[] }}
 */
export function detectCrisis(text) {
  const normalized = normalizeForDetection(text);

  if (!normalized) {
    return { hasRisk: false, riskLevel: 'none', keywords: [] };
  }

  const highMatches = collectMatches(normalized, HIGH_RISK_PATTERNS);

  if (typeof text === 'string' && collapseSpacedLetters(text.toLowerCase()) !== text.toLowerCase()) {
    const compact = normalized.replace(/[^a-z0-9]/g, '');
    OBFUSCATED_COMPACT_PHRASES.forEach((phrase) => {
      if (compact.includes(phrase)) {
        highMatches.push(`obfuscated:${phrase}`);
      }
    });
  }

  if (highMatches.length > 0) {
    return { hasRisk: true, riskLevel: 'high', keywords: highMatches };
  }

  const ambiguousMatches = collectMatches(normalized, AMBIGUOUS_RISK_PATTERNS);
  if (ambiguousMatches.length > 0 && hasSelfReference(normalized)) {
    return { hasRisk: true, riskLevel: 'moderate', keywords: ambiguousMatches };
  }

  return { hasRisk: false, riskLevel: 'none', keywords: [] };
}

export function crisisRiskFlags(detection) {
  return detection?.hasRisk ? [RISK_FLAGS.CRISIS_DETECTED] : [];
}

// Mirrors ai_service/prompts.py CRISIS_RESPONSE so the safety reply is identical
// whether it is produced by the backend or by the AI service.
export const CRISIS_REPLY = [
  "I'm really glad you shared this. It sounds like you're carrying something very heavy right now, and you deserve immediate support from a real person nearby.",
  'Please reach out to someone you trust right now, and contact your local crisis line or emergency services. If you are in immediate danger, call your local emergency number now.',
  'You can also find a helpline for your country at https://findahelpline.com (US: call or text 988). I will stay with you here, but please do not go through this alone.',
].join('\n\n');

export const CRISIS_FOLLOWUP =
  'Are you able to contact someone you trust right now, or would it help to look up a local crisis line together?';
