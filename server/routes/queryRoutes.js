import { Router } from 'express';
import * as ctrl from '../controllers/queryController.js';
import * as answerCtrl from '../controllers/answerController.js';
import { auth, optionalAuth } from '../middleware/auth.js';
import { banCheck } from '../middleware/banCheck.js';
import { aiLimiter, writeLimiter } from '../middleware/rateLimit.js';
import { screenshotUpload } from '../middleware/upload.js';

const router = Router();

// Public reads (optionalAuth so the viewer's ownership can be reflected).
router.get('/', optionalAuth, ctrl.list);

// Opt-in grammar check (AI-backed, rate-limited).
router.post('/check-grammar', auth, aiLimiter, ctrl.checkGrammar);

router.get('/:id', optionalAuth, ctrl.detail);

// Writes require a logged-in, non-banned user.
router.post('/', auth, banCheck, aiLimiter, screenshotUpload, ctrl.create);
router.patch('/:id', auth, banCheck, ctrl.update);
router.delete('/:id', auth, ctrl.remove);

// Answers + solution engine (Milestone 3), nested under the query.
router.get('/:queryId/answers', optionalAuth, answerCtrl.list);
router.post('/:queryId/answers', auth, banCheck, writeLimiter, answerCtrl.post);
router.post('/:id/solution', auth, banCheck, answerCtrl.markSolution);
router.post('/:id/report', auth, banCheck, writeLimiter, answerCtrl.reportQuery);

export default router;
