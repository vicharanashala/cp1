import { Router } from 'express';
import * as ctrl from '../controllers/chatbotController.js';
import { optionalAuth } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/rateLimit.js';

// Public chatbot (optionalAuth links a session to a user when logged in).
const router = Router();

router.post('/ask', optionalAuth, aiLimiter, ctrl.ask);
router.get('/session/:token', optionalAuth, ctrl.session);

export default router;
