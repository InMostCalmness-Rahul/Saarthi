import { randomUUID } from 'node:crypto';
import User from '../models/User.js';
import Message from '../models/Message.js';
import Session from '../models/Session.js';
import ActionCommitment from '../models/ActionCommitment.js';
import TrustHistory from '../models/TrustHistory.js';
import { RISK_FLAGS, TRUST_REASONS, TRUST_SCORE_DEFAULT } from '../config/constants.js';
import { asyncHandler, sendSuccess } from '../utils/http.js';
import { logger, pseudonymize } from '../utils/logger.js';
import { detectCrisis } from '../utils/crisisDetection.js';
import {
  computeActionTrustDelta,
  computeChatTrustDelta,
  getTrustPhase,
} from '../utils/trustScore.js';
import {
  buildCrisisResponse,
  normalizeRiskFlags,
  requestAiResponse,
} from '../services/aiService.js';
import { recordSessionActivity, resolveSession } from '../services/sessionService.js';
import { applyTrustChange } from '../services/trustService.js';
import { findUser, getOrCreateUser, setProactiveNudgesConsent } from '../services/userService.js';

// POST /api/chat - Process one chat turn for the authenticated user.
// Identity comes exclusively from the session token (req.userId).
export const postChat = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const { message, sessionId } = req.body;

  const user = await getOrCreateUser(userId);
  const session = await resolveSession({ sessionId, userId, req });

  const userMessageDoc = await Message.create({
    messageId: `msg_${randomUUID()}`,
    sessionId: session.sessionId,
    userId,
    sender: 'user',
    content: message,
    sentAt: new Date(),
  });

  const trustPhase = getTrustPhase(user.trustScore);
  const localDetection = detectCrisis(message);

  let aiResponse;
  let fallbackUsed = false;

  if (localDetection.hasRisk) {
    // Safety path runs before (and independently of) the model, so crisis handling
    // still works when the AI service is down.
    aiResponse = buildCrisisResponse();
    logger.warn('crisis_detected_by_backend', {
      userId: pseudonymize(userId),
      riskLevel: localDetection.riskLevel,
    });
  } else {
    const result = await requestAiResponse({ message, trustPhase, userId });
    aiResponse = result.response;
    fallbackUsed = result.fallbackUsed;
  }

  const riskFlags = normalizeRiskFlags(aiResponse.risk_flags);
  if (localDetection.hasRisk && !riskFlags.includes(RISK_FLAGS.CRISIS_DETECTED)) {
    riskFlags.push(RISK_FLAGS.CRISIS_DETECTED);
  }
  if (fallbackUsed && !riskFlags.includes(RISK_FLAGS.FALLBACK_ACTIVE)) {
    riskFlags.push(RISK_FLAGS.FALLBACK_ACTIVE);
  }

  const botMessageDoc = await Message.create({
    messageId: `msg_${randomUUID()}`,
    sessionId: session.sessionId,
    userId,
    sender: 'bot',
    content: aiResponse.content,
    emotional_validation: aiResponse.emotional_validation,
    reconnection_nudge: aiResponse.reconnection_nudge,
    tiny_action: aiResponse.tiny_action,
    followup_question: aiResponse.followup_question,
    risk_flags: riskFlags,
    sentAt: new Date(),
  });

  const isCrisis = riskFlags.includes(RISK_FLAGS.CRISIS_DETECTED);
  const trustChange = await applyTrustChange({
    user,
    delta: computeChatTrustDelta({ riskFlags, tinyAction: aiResponse.tiny_action }),
    reason: isCrisis ? TRUST_REASONS.CRISIS_DETECTED : TRUST_REASONS.CHAT_INTERACTION,
    sessionId: session.sessionId,
  });

  const sessionLength = await recordSessionActivity(session, 2);

  return sendSuccess(res, {
    userMessage: {
      id: userMessageDoc.messageId,
      sender: userMessageDoc.sender,
      content: userMessageDoc.content,
      timestamp: userMessageDoc.sentAt.toISOString(),
    },
    botResponse: {
      id: botMessageDoc.messageId,
      sender: botMessageDoc.sender,
      content: botMessageDoc.content,
      emotional_validation: botMessageDoc.emotional_validation,
      reconnection_nudge: botMessageDoc.reconnection_nudge,
      tiny_action: botMessageDoc.tiny_action,
      followup_question: botMessageDoc.followup_question,
      risk_flags: riskFlags,
      timestamp: botMessageDoc.sentAt.toISOString(),
    },
    sessionId: session.sessionId,
    sessionLength,
    trustScore: trustChange.newScore,
    trustPhase: getTrustPhase(trustChange.newScore),
    fallbackUsed,
  });
});

// POST /api/action-update - Record an action commitment.
// `completed` is a boolean; the trust delta is derived server-side.
export const postActionUpdate = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const { actionCommitment, completed, sessionId } = req.body;

  if (sessionId) {
    await resolveSession({ sessionId, userId, req });
  }

  const user = await getOrCreateUser(userId);
  const delta = computeActionTrustDelta({ completed });

  const trustChange = await applyTrustChange({
    user,
    delta,
    reason: completed ? TRUST_REASONS.ACTION_COMPLETED : TRUST_REASONS.ACTION_DECLINED,
    sessionId: sessionId ?? null,
  });

  await ActionCommitment.create({
    userId,
    sessionId: sessionId ?? null,
    actionCommitment,
    trustScoreDelta: delta,
    completed,
    committedAt: new Date(),
  });

  return sendSuccess(res, {
    actionCommitment,
    completed,
    trustScoreDelta: delta,
    trustScore: trustChange.newScore,
    trustPhase: getTrustPhase(trustChange.newScore),
    updatedAt: new Date().toISOString(),
  });
});

// GET /api/trust-score - Trust score for the authenticated user (token-scoped).
export const getTrustScore = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const user = await findUser(userId);
  const trustScore = user?.trustScore ?? TRUST_SCORE_DEFAULT;

  return sendSuccess(res, {
    userId,
    trustScore,
    phase: getTrustPhase(trustScore),
    retrievedAt: new Date().toISOString(),
  });
});

// GET /api/preferences - Read-only. A GET must never create a record, otherwise
// any read traffic (including IDOR scanning) silently populates the database.
export const getPreferences = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const user = await findUser(userId);

  return sendSuccess(res, {
    userId,
    proactiveNudgesConsent: user?.proactiveNudgesConsent ?? false,
    consentUpdatedAt: user?.consentUpdatedAt ?? null,
  });
});

// PUT /api/preferences - Update consent preferences.
export const updatePreferences = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const { proactiveNudgesConsent } = req.body;

  const user = await setProactiveNudgesConsent(userId, proactiveNudgesConsent);

  return sendSuccess(res, {
    userId,
    proactiveNudgesConsent: user.proactiveNudgesConsent,
    consentUpdatedAt: user.consentUpdatedAt,
  });
});

// GET /api/user-data/export - Export all data owned by the authenticated user.
export const exportUserData = asyncHandler(async (req, res) => {
  const userId = req.userId;

  const [user, sessions, messages, actionCommitments, trustHistory] = await Promise.all([
    User.findOne({ userId }).lean(),
    Session.find({ userId }).sort({ createdAt: -1 }).lean(),
    Message.find({ userId }).sort({ createdAt: -1 }).lean(),
    ActionCommitment.find({ userId }).sort({ createdAt: -1 }).lean(),
    TrustHistory.find({ userId }).sort({ createdAt: -1 }).lean(),
  ]);

  logger.info('user_data_exported', { userId: pseudonymize(userId), messages: messages.length });

  return sendSuccess(res, {
    userId,
    exportedAt: new Date().toISOString(),
    user,
    sessions,
    messages,
    actionCommitments,
    trustHistory,
  });
});

// DELETE /api/user-data - Permanently delete all data owned by the authenticated user.
export const deleteUserData = asyncHandler(async (req, res) => {
  const userId = req.userId;

  const sessionIds = (await Session.find({ userId }).select('sessionId -_id').lean()).map(
    (session) => session.sessionId
  );

  const [messages, actionCommitments, trustHistory, sessions, users, orphanMessages] =
    await Promise.all([
      Message.deleteMany({ userId }),
      ActionCommitment.deleteMany({ userId }),
      TrustHistory.deleteMany({ userId }),
      Session.deleteMany({ userId }),
      User.deleteOne({ userId }),
      sessionIds.length > 0
        ? Message.deleteMany({ sessionId: { $in: sessionIds } })
        : Promise.resolve({ deletedCount: 0 }),
    ]);

  const deleted = {
    messages: messages.deletedCount ?? 0,
    actionCommitments: actionCommitments.deletedCount ?? 0,
    trustHistory: trustHistory.deletedCount ?? 0,
    sessions: sessions.deletedCount ?? 0,
    users: users.deletedCount ?? 0,
    orphanMessages: orphanMessages.deletedCount ?? 0,
  };

  logger.info('user_data_deleted', { userId: pseudonymize(userId), ...deleted });

  return sendSuccess(res, {
    userId,
    deletedAt: new Date().toISOString(),
    deleted,
  });
});
