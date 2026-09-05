import axios from 'axios';
import { randomUUID } from 'node:crypto';
import User from '../models/User.js';
import Session from '../models/Session.js';
import Message from '../models/Message.js';
import ActionCommitment from '../models/ActionCommitment.js';
import TrustHistory from '../models/TrustHistory.js';

// Configuration
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';

// Helper function to determine trust phase
function getTrustPhase(trustScore) {
  if (trustScore < 40) return 'listening';
  if (trustScore < 70) return 'momentum';
  return 'accountability';
}

// POST /api/chat - Process a chat message
export const postChat = async (req, res) => {
  try {
    const { message, userId, sessionId } = req.body;

    const safeSessionId = sessionId || `session_${Date.now()}`;

    let user = await User.findOne({ userId });
    if (!user) {
      user = await User.create({
        userId,
        trustScore: 50,
        proactiveNudgesConsent: false,
        consentUpdatedAt: new Date(),
      });
    }

    await Session.findOneAndUpdate(
      { sessionId: safeSessionId },
      { sessionId: safeSessionId, userId, startedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    
    // Store user message
    const userMsgId = `msg_${randomUUID()}`;
    const userMessageDoc = await Message.create({
      messageId: userMsgId,
      sessionId: safeSessionId,
      userId,
      sender: 'user',
      content: message,
      sentAt: new Date(),
    });

    const userMsg = {
      id: userMessageDoc.messageId,
      sender: userMessageDoc.sender,
      content: userMessageDoc.content,
      timestamp: userMessageDoc.sentAt.toISOString(),
    };
    
    // Call Python AI service to generate response
    const trustPhase = getTrustPhase(user.trustScore);
    
    let aiRaw;
    try {
      const response = await axios.post(`${AI_SERVICE_URL}/generate-response`, {
        message: message,
        trust_phase: trustPhase,
        user_id: userId
      }, {
        timeout: 10000 // 10 second timeout
      });

      if (response.data && response.data.success) {
        aiRaw = response.data.data;
      } else {
        throw new Error('AI service returned error: ' + (response.data?.error || 'unknown'));
      }
    } catch (aiError) {
      console.error('Error calling AI service:', aiError.message);
      // Fallback response if AI service fails
      aiRaw = {
        emotional_validation: 'I hear you, and I\'m here to listen.',
        reconnection_nudge: null,
        tiny_action: 'Take a moment to breathe - you\'re doing the right thing by reaching out.',
        followup_question: 'What feels most important to focus on right now?',
        risk_flags: ['FALLBACK_ACTIVE'],
        content: 'I hear you, and I\'m here to listen.\n\nTake a moment to breathe - you\'re doing the right thing by reaching out.\n\nWhat feels most important to focus on right now?'
      };
    }

    // Normalise AI response into object form (support natural-string responses)
    function _firstSentence(text) {
      if (!text) return null;
      const nl = text.split('\n')[0].trim();
      const match = nl.match(/.*?[\.!\?](\s|$)/);
      if (match) return match[0].trim();
      return nl.slice(0, 200);
    }

    function _trailingQuestion(text) {
      if (!text) return null;
      const qMatch = text.match(/([^\n\r\?]{5,}\?)(?![\s\S]*\?)/);
      if (qMatch) return qMatch[1].trim();
      // fallback: any question mark chunk
      const allQ = text.match(/[^\n\r\?]{5,}\?/g);
      if (allQ && allQ.length) return allQ[allQ.length - 1].trim();
      return null;
    }

    let aiResponse;
    if (typeof aiRaw === 'string') {
      aiResponse = {
        content: aiRaw,
        emotional_validation: _firstSentence(aiRaw) || 'I hear you, and I\'m here to listen.',
        reconnection_nudge: null,
        tiny_action: null,
        followup_question: _trailingQuestion(aiRaw),
        risk_flags: []
      };
    } else if (aiRaw && typeof aiRaw === 'object') {
      const contentText = aiRaw.content || (aiRaw.text || '').toString();
      aiResponse = {
        content: contentText || JSON.stringify(aiRaw),
        emotional_validation: aiRaw.emotional_validation || _firstSentence(contentText) || 'I hear you, and I\'m here to listen.',
        reconnection_nudge: aiRaw.reconnection_nudge || null,
        tiny_action: aiRaw.tiny_action || null,
        followup_question: aiRaw.followup_question || _trailingQuestion(contentText),
        risk_flags: aiRaw.risk_flags || []
      };
    } else {
      // unexpected form — coerce to string
      const text = String(aiRaw);
      aiResponse = {
        content: text,
        emotional_validation: _firstSentence(text) || 'I hear you, and I\'m here to listen.',
        reconnection_nudge: null,
        tiny_action: null,
        followup_question: _trailingQuestion(text),
        risk_flags: []
      };
    }

    // Create bot response message (store the natural content and any heuristics)
    const botMsgId = `msg_${randomUUID()}`;
    const botMessageDoc = await Message.create({
      messageId: botMsgId,
      sessionId: safeSessionId,
      userId,
      sender: 'bot',
      content: aiResponse.content,
      emotional_validation: aiResponse.emotional_validation,
      reconnection_nudge: aiResponse.reconnection_nudge,
      tiny_action: aiResponse.tiny_action,
      followup_question: aiResponse.followup_question,
      risk_flags: aiResponse.risk_flags || [],
      sentAt: new Date(),
    });

    const botResponse = {
      id: botMessageDoc.messageId,
      sender: botMessageDoc.sender,
      content: botMessageDoc.content,
      emotional_validation: botMessageDoc.emotional_validation,
      reconnection_nudge: botMessageDoc.reconnection_nudge,
      tiny_action: botMessageDoc.tiny_action,
      followup_question: botMessageDoc.followup_question,
      risk_flags: botMessageDoc.risk_flags || [],
      timestamp: botMessageDoc.sentAt.toISOString(),
    };

    // Update trust score based on response. Default positive delta for supportive replies, negative for crisis.
    let trustDelta = (aiResponse.risk_flags || []).includes('CRISIS_DETECTED') ? -10 : 3;
    if (aiResponse.tiny_action) trustDelta += 2; // slightly more convincing when offering a helpful tiny action
    const previousScore = user.trustScore;
    const newTrustScore = Math.max(0, Math.min(100, previousScore + trustDelta));
    user.trustScore = newTrustScore;
    await user.save();

    await TrustHistory.create({
      userId,
      sessionId: safeSessionId,
      previousScore,
      delta: trustDelta,
      newScore: newTrustScore,
      reason: aiResponse.risk_flags?.includes('CRISIS_DETECTED')
        ? 'CRISIS_DETECTED'
        : 'CHAT_INTERACTION',
      recordedAt: new Date(),
    });

    const sessionLength = await Message.countDocuments({ sessionId: safeSessionId });
    
    res.json({
      success: true,
      data: {
        userMessage: userMsg,
        botResponse: botResponse,
        sessionLength,
        trustScore: newTrustScore
      }
    });
  } catch (error) {
    console.error('Error in postChat:', error);
    res.status(500).json({
      success: false,
      error: {
        status: 500,
        message: 'Error processing chat message',
        details: error.message
      }
    });
  }
};

// POST /api/action-update - Update action commitment and trust score
export const postActionUpdate = async (req, res) => {
  try {
    const { userId, actionCommitment, trustScoreDelta, sessionId } = req.body;

    let user = await User.findOne({ userId });
    if (!user) {
      user = await User.create({
        userId,
        trustScore: 50,
        proactiveNudgesConsent: false,
        consentUpdatedAt: new Date(),
      });
    }

    const previousScore = user.trustScore;
    const newTrustScore = Math.max(0, Math.min(100, previousScore + trustScoreDelta));
    user.trustScore = newTrustScore;
    await user.save();

    await ActionCommitment.create({
      userId,
      sessionId: sessionId || null,
      actionCommitment,
      trustScoreDelta,
      committedAt: new Date(),
    });

    await TrustHistory.create({
      userId,
      sessionId: sessionId || null,
      previousScore,
      delta: trustScoreDelta,
      newScore: newTrustScore,
      reason: 'ACTION_UPDATE',
      recordedAt: new Date(),
    });
    
    res.json({
      success: true,
      data: {
        userId,
        actionCommitment,
        trustScoreDelta,
        newTrustScore,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        status: 500,
        message: 'Error updating action',
        details: error.message
      }
    });
  }
};

// GET /api/trust-score/:userId - Get current trust score
export const getTrustScore = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findOne({ userId });
    const trustScore = user?.trustScore ?? 50;
    
    res.json({
      success: true,
      data: {
        userId,
        trustScore,
        phase: getTrustPhase(trustScore),
        retrievedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        status: 500,
        message: 'Error retrieving trust score',
        details: error.message
      }
    });
  }
};

// GET /api/preferences/:userId - Get user consent preferences
export const getPreferences = async (req, res) => {
  try {
    const { userId } = req.params;

    let user = await User.findOne({ userId });
    if (!user) {
      user = await User.create({
        userId,
        trustScore: 50,
        proactiveNudgesConsent: false,
        consentUpdatedAt: new Date(),
      });
    }

    res.json({
      success: true,
      data: {
        userId,
        proactiveNudgesConsent: user.proactiveNudgesConsent,
        consentUpdatedAt: user.consentUpdatedAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        status: 500,
        message: 'Error retrieving preferences',
        details: error.message,
      },
    });
  }
};

// PUT /api/preferences/:userId - Update user consent preferences
export const updatePreferences = async (req, res) => {
  try {
    const { userId } = req.params;
    const { proactiveNudgesConsent } = req.body;

    const user = await User.findOneAndUpdate(
      { userId },
      {
        userId,
        proactiveNudgesConsent,
        consentUpdatedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      data: {
        userId,
        proactiveNudgesConsent: user.proactiveNudgesConsent,
        consentUpdatedAt: user.consentUpdatedAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        status: 500,
        message: 'Error updating preferences',
        details: error.message,
      },
    });
  }
};

// GET /api/user-data/:userId/export - Export all user data
export const exportUserData = async (req, res) => {
  try {
    const { userId } = req.params;

    const [user, sessions, messages, actionCommitments, trustHistory] = await Promise.all([
      User.findOne({ userId }).lean(),
      Session.find({ userId }).sort({ createdAt: -1 }).lean(),
      Message.find({ userId }).sort({ createdAt: -1 }).lean(),
      ActionCommitment.find({ userId }).sort({ createdAt: -1 }).lean(),
      TrustHistory.find({ userId }).sort({ createdAt: -1 }).lean(),
    ]);

    res.json({
      success: true,
      data: {
        userId,
        exportedAt: new Date().toISOString(),
        user,
        sessions,
        messages,
        actionCommitments,
        trustHistory,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        status: 500,
        message: 'Error exporting user data',
        details: error.message,
      },
    });
  }
};

// DELETE /api/user-data/:userId - Delete all user data
export const deleteUserData = async (req, res) => {
  try {
    const { userId } = req.params;

    const sessionIds = (await Session.find({ userId }).select('sessionId -_id').lean()).map(
      (s) => s.sessionId
    );

    await Promise.all([
      Message.deleteMany({ userId }),
      ActionCommitment.deleteMany({ userId }),
      TrustHistory.deleteMany({ userId }),
      Session.deleteMany({ userId }),
      User.deleteOne({ userId }),
      sessionIds.length > 0 ? Message.deleteMany({ sessionId: { $in: sessionIds } }) : Promise.resolve(),
    ]);

    res.json({
      success: true,
      data: {
        userId,
        deletedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        status: 500,
        message: 'Error deleting user data',
        details: error.message,
      },
    });
  }
};
