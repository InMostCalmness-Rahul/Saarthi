import express from 'express';
import {
  validateChatMessage,
  validateActionUpdate,
  validatePreferencesUpdate,
} from '../middleware/validation.js';
import {
  requireAuth,
  requireOwnership,
  rejectConflictingBodyUserId,
  createRateLimiter,
} from '../middleware/auth.js';
import {
  postChat,
  postActionUpdate,
  getTrustScore,
  getPreferences,
  updatePreferences,
  exportUserData,
  deleteUserData,
} from '../controllers/chatController.js';

const router = express.Router();

// Abuse dampening. Limits are generous for normal chat usage and are disabled
// automatically when NODE_ENV=test or RATE_LIMIT_DISABLED=1.
const chatLimiter = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.CHAT_RATE_LIMIT_MAX || 60),
  name: 'chat',
});
const writeLimiter = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.WRITE_RATE_LIMIT_MAX || 30),
  name: 'write',
});

// --- Token-scoped routes (preferred) -------------------------------------
// Identity always comes from the signed session token.
router.post('/chat', requireAuth, chatLimiter, rejectConflictingBodyUserId, validateChatMessage, postChat);
router.post('/action-update', requireAuth, writeLimiter, rejectConflictingBodyUserId, validateActionUpdate, postActionUpdate);
router.get('/trust-score', requireAuth, getTrustScore);
router.get('/preferences', requireAuth, getPreferences);
router.put('/preferences', requireAuth, writeLimiter, rejectConflictingBodyUserId, validatePreferencesUpdate, updatePreferences);
router.get('/user-data/export', requireAuth, exportUserData);
router.delete('/user-data', requireAuth, writeLimiter, deleteUserData);

// --- Legacy user-scoped URLs --------------------------------------------
// Kept for backwards compatibility, but the path parameter may only reference
// the authenticated user (closes the previous IDOR surface).
router.get('/trust-score/:userId', requireAuth, requireOwnership, getTrustScore);
router.get('/preferences/:userId', requireAuth, requireOwnership, getPreferences);
router.put('/preferences/:userId', requireAuth, writeLimiter, requireOwnership, validatePreferencesUpdate, updatePreferences);
router.get('/user-data/:userId/export', requireAuth, requireOwnership, exportUserData);
router.delete('/user-data/:userId', requireAuth, writeLimiter, requireOwnership, deleteUserData);

export default router;
