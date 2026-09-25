import TrustHistory from '../models/TrustHistory.js';
import { clampTrustScore } from '../utils/trustScore.js';

/**
 * Applies a server-decided trust delta and records the audit trail.
 * `delta` is always derived server-side (utils/trustScore.js) — never by a client.
 */
export async function applyTrustChange({ user, delta, reason, sessionId = null }) {
  const previousScore = clampTrustScore(user.trustScore);
  const newScore = clampTrustScore(previousScore + delta);

  user.trustScore = newScore;
  await user.save();

  await TrustHistory.create({
    userId: user.userId,
    sessionId,
    previousScore,
    delta,
    newScore,
    reason,
    recordedAt: new Date(),
  });

  return { previousScore, newScore, delta, reason };
}
