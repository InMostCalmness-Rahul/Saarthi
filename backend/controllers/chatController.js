// Mock data storage (will be replaced with MongoDB)
const sessions = {};
const userTrustScores = {};

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
    
    // TODO: Call Python AI service to generate response
    // For now, return mock response
    const botResponse = {
      id: `msg_${Date.now() + 1}`,
      sender: 'bot',
      content: `I hear you. Let's explore this together.`,
      emotional_validation: 'Your feelings matter.',
      reconnection_nudge: null,
      tiny_action: 'Take a deep breath',
      followup_question: 'What do you think would help?',
      risk_flags: [],
      timestamp: new Date().toISOString()
    };
    
    sessions[userId].push(botResponse);
    
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

// GET /api/trust-score - Get user's current trust score
export const getTrustScore = async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          status: 400,
          message: 'userId query parameter is required'
        }
      });
    }
    
    const trustScore = userTrustScores[userId] || 50;
    const sessionLength = sessions[userId]?.length || 0;
    
    res.json({
      success: true,
      data: {
        userId,
        trustScore,
        sessionLength,
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
