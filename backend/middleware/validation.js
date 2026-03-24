// Request validation middleware
export const requestValidator = (req, res, next) => {
  // Log incoming request
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  
  // Check required headers for POST/PUT requests
  if (['POST', 'PUT'].includes(req.method)) {
    if (!req.is('application/json')) {
      return res.status(400).json({
        success: false,
        error: {
          status: 400,
          message: 'Content-Type must be application/json'
        }
      });
    }
  }
  
  next();
};

// Validation helpers
export const validateChatMessage = (req, res, next) => {
  const { message, userId } = req.body;
  
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        status: 400,
        message: 'Message is required and must be a non-empty string'
      }
    });
  }
  
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({
      success: false,
      error: {
        status: 400,
        message: 'userId is required and must be a string'
      }
    });
  }
  
  next();
};

export const validateActionUpdate = (req, res, next) => {
  const { userId, actionCommitment, trustScoreDelta } = req.body;
  
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({
      success: false,
      error: {
        status: 400,
        message: 'userId is required and must be a string'
      }
    });
  }
  
  if (!actionCommitment || typeof actionCommitment !== 'string') {
    return res.status(400).json({
      success: false,
      error: {
        status: 400,
        message: 'actionCommitment is required and must be a string'
      }
    });
  }
  
  if (typeof trustScoreDelta !== 'number') {
    return res.status(400).json({
      success: false,
      error: {
        status: 400,
        message: 'trustScoreDelta is required and must be a number'
      }
    });
  }
  
  next();
};
