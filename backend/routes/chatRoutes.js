import express from 'express';
import { validateChatMessage, validateActionUpdate } from '../middleware/validation.js';
import {
  postChat,
  postActionUpdate,
  getTrustScore
} from '../controllers/chatController.js';

const router = express.Router();

// Chat endpoints
router.post('/chat', validateChatMessage, postChat);
router.post('/action-update', validateActionUpdate, postActionUpdate);
router.get('/trust-score', getTrustScore);

export default router;
