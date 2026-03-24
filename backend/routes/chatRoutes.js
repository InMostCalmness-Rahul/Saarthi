import express from 'express';
import {
  validateChatMessage,
  validateActionUpdate,
  validatePreferencesUpdate,
} from '../middleware/validation.js';
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

// Chat endpoints
router.post('/chat', validateChatMessage, postChat);
router.post('/action-update', validateActionUpdate, postActionUpdate);
router.get('/trust-score/:userId', getTrustScore);
router.get('/preferences/:userId', getPreferences);
router.put('/preferences/:userId', validatePreferencesUpdate, updatePreferences);
router.get('/user-data/:userId/export', exportUserData);
router.delete('/user-data/:userId', deleteUserData);

export default router;
