import { Router } from 'express';
import * as ctrl from '../controllers/answerController.js';
import { auth } from '../middleware/auth.js';
import { banCheck } from '../middleware/banCheck.js';
import { writeLimiter } from '../middleware/rateLimit.js';

// Actions on a specific answer (the nested create/list lives on queryRoutes).
const router = Router();

router.post('/:id/like', auth, banCheck, writeLimiter, ctrl.like);
router.post('/:id/report', auth, banCheck, writeLimiter, ctrl.reportAnswer);
router.delete('/:id', auth, ctrl.remove);

export default router;
