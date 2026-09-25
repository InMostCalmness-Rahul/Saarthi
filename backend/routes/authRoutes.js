import express from 'express';
import { createSession, getCurrentUser } from '../controllers/authController.js';
import { requireAuth, createRateLimiter } from '../middleware/auth.js';

const router = express.Router();

// Session minting is cheap but unauthenticated, so it is the most attractive
// endpoint for automated abuse.
const sessionLimiter = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 30),
  name: 'auth_session',
});

router.post('/session', sessionLimiter, createSession);
router.get('/me', requireAuth, getCurrentUser);

export default router;
