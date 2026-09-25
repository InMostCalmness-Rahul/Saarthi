import { randomUUID } from 'node:crypto';
import Session from '../models/Session.js';
import { conflict } from '../utils/http.js';
import { logSecurityEvent } from '../utils/logger.js';

/**
 * Resolves (or creates) the session for an authenticated user.
 *
 * Security: an existing session is NEVER rebound to a different user. The previous
 * implementation upserted on `{ sessionId }` alone while writing `userId`, which let
 * anyone who knew a victim's session id silently take over that session.
 */
export async function resolveSession({ sessionId, userId, req }) {
  if (!sessionId) {
    return Session.create({ sessionId: `session_${randomUUID()}`, userId });
  }

  const existing = await Session.findOne({ sessionId });

  if (!existing) {
    return Session.create({ sessionId, userId });
  }

  if (existing.userId !== userId) {
    logSecurityEvent('session_ownership_violation', req, {
      sessionId,
      sessionOwnerId: existing.userId,
      requesterId: userId,
    });
    throw conflict('This session does not belong to the authenticated user');
  }

  return existing;
}

/**
 * Keeps `messageCount` on the session instead of running a `countDocuments`
 * aggregation on every chat turn.
 */
export async function recordSessionActivity(session, messagesAdded) {
  await Session.updateOne(
    { _id: session._id },
    { $set: { startedAt: new Date() }, $inc: { messageCount: messagesAdded } }
  );

  return (session.messageCount ?? 0) + messagesAdded;
}
