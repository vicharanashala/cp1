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

// Opt-in "Refine with AI" pass (AI-backed, rate-limited).
router.post('/refine', auth, aiLimiter, ctrl.refine);

// The current user's saved questions (must precede /:id).
router.get('/bookmarks', auth, ctrl.bookmarks);

// Distinct categories for filter dropdowns (must precede /:id).
router.get('/categories', ctrl.categories);

// Hybrid search over forum questions (must precede /:id).
router.get('/search', optionalAuth, ctrl.search);

router.get('/:id', optionalAuth, ctrl.detail);

// Writes require a logged-in, non-banned user.
router.post('/', auth, banCheck, aiLimiter, screenshotUpload, ctrl.create);
router.patch('/:id', auth, banCheck, ctrl.update);
router.delete('/:id', auth, ctrl.remove);
router.post('/:id/restore', auth, ctrl.restore);

// Engagement: up/down vote a question; bookmark/unbookmark it.
router.post('/:id/vote', auth, banCheck, writeLimiter, ctrl.vote);
router.post('/:id/save', auth, ctrl.save);

// Escalation: an Expert-level member flags a question for admin attention.
router.post('/:id/attention', auth, banCheck, ctrl.flagAttention);

// Moderators/admins re-categorise or re-tag a question seen in the forum.
router.patch('/:id/taxonomy', auth, banCheck, ctrl.retag);

// Answers + solution engine (Milestone 3), nested under the query.
router.get('/:queryId/answers', optionalAuth, answerCtrl.list);
router.post('/:queryId/answers', auth, banCheck, writeLimiter, answerCtrl.post);
router.post('/:id/solution', auth, banCheck, answerCtrl.markSolution);
router.post('/:id/report', auth, banCheck, writeLimiter, answerCtrl.reportQuery);

export default router;
