import { Router } from 'express';
import * as ctrl from '../controllers/userController.js';
import { auth } from '../middleware/auth.js';

const router = Router();

// Static + /me routes must precede /:id so they aren't captured as a user id.
router.get('/leaderboard', ctrl.leaderboard);
router.get('/me/activity', auth, ctrl.activity);
router.patch('/me', auth, ctrl.updateMe);
router.get('/:id', ctrl.profile);

export default router;
