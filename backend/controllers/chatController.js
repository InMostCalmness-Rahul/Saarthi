import axios from 'axios';

// Configuration
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';

// Mock data storage (will be replaced with MongoDB)
const sessions = {};
const userTrustScores = {};

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
    
    // Initialize session if needed
    if (!sessions[userId]) {
      sessions[userId] = [];
    }
    
    if (!userTrustScores[userId]) {
      userTrustScores[userId] = 50; // Default trust score
    }
    
    // Store user message
    const userMsg = {
      id: `msg_${Date.now()}`,
      sender: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    
    sessions[userId].push(userMsg);
    
    // Call Python AI service to generate response
    const trustPhase = getTrustPhase(userTrustScores[userId]);
    
    let aiResponse;
    try {
      const response = await axios.post(`${AI_SERVICE_URL}/generate-response`, {
        message: message,
        trust_phase: trustPhase,
        user_id: userId
      }, {
        timeout: 10000 // 10 second timeout
      });
      
      if (response.data.success) {
        aiResponse = response.data.data;
      } else {
        throw new Error('AI service returned error: ' + response.data.error);
      }
    } catch (aiError) {
      console.error('Error calling AI service:', aiError.message);
      // Fallback response if AI service fails
      aiResponse = {
        emotional_validation: 'I hear you, and I\'m here to listen.',
        reconnection_nudge: null,
        tiny_action: 'Take a moment to breathe - you\'re doing the right thing by reaching out.',
        followup_question: 'What feels most important to focus on right now?',
        risk_flags: ['FALLBACK_ACTIVE'],
        content: 'I hear you, and I\'m here to listen.\n\nTake a moment to breathe - you\'re doing the right thing by reaching out.\n\nWhat feels most important to focus on right now?'
      };
    }
    
    // Create bot response message
    const botResponse = {
      id: `msg_${Date.now() + 1}`,
      sender: 'bot',
      content: aiResponse.content,
      emotional_validation: aiResponse.emotional_validation,
      reconnection_nudge: aiResponse.reconnection_nudge,
      tiny_action: aiResponse.tiny_action,
      followup_question: aiResponse.followup_question,
      risk_flags: aiResponse.risk_flags || [],
      timestamp: new Date().toISOString()
    };
    
    sessions[userId].push(botResponse);
    
    // Update trust score based on response
    const trustDelta = aiResponse.risk_flags?.includes('CRISIS_DETECTED') ? -5 : 2;
    userTrustScores[userId] = Math.max(0, Math.min(100, userTrustScores[userId] + trustDelta));
    
    res.json({
      success: true,
      data: {
        userMessage: userMsg,
        botResponse: botResponse,
        sessionLength: sessions[userId].length,
        trustScore: userTrustScores[userId]
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
    const { userId, actionCommitment, trustScoreDelta } = req.body;
    
    if (!userTrustScores[userId]) {
      userTrustScores[userId] = 50;
    }
    
    // Update trust score
    userTrustScores[userId] = Math.max(0, Math.min(100, userTrustScores[userId] + trustScoreDelta));
    
    res.json({
      success: true,
      data: {
        userId,
        actionCommitment,
        trustScoreDelta,
        newTrustScore: userTrustScores[userId],
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
    
    const trustScore = userTrustScores[userId] || 50;
    
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
