import { Router } from 'express';
import * as ctrl from '../controllers/faqController.js';
import { auth, admin } from '../middleware/auth.js';

const router = Router();

router.get('/', ctrl.list);
router.get('/search', ctrl.search);

// Promote a resolved community question into the FAQ (admin).
router.post('/promote/:queryId', auth, admin, ctrl.promote);

export default router;
