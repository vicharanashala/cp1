import { Router } from 'express';
import * as ctrl from '../controllers/adminController.js';
import { auth, admin } from '../middleware/auth.js';

// Governance + admin tooling (admin only).
const router = Router();
router.use(auth, admin);

router.get('/metrics', ctrl.metrics);

// User management.
router.get('/users', ctrl.listUsers);
router.post('/users/:id/ban', ctrl.banUser);
router.post('/users/:id/unban', ctrl.unbanUser);
router.post('/users/:id/badge', ctrl.issueNegativeBadge);
router.delete('/users/:id/badge/:key', ctrl.revokeNegativeBadge);
router.post('/users/:id/custom-badge', ctrl.awardCustomBadge);
router.delete('/users/:id/custom-badge/:key', ctrl.revokeCustomBadge);
router.post('/users/:id/role', ctrl.setRole);

// Moderation queue.
router.get('/moderation', ctrl.listModeration);
router.post('/moderation/:id/resolve', ctrl.resolveModeration);
router.post('/moderation/:id/dismiss', ctrl.dismissModeration);

// Query amalgamation / merge + topic grouping + attention queue.
router.get('/queries/clusters', ctrl.queryClusters);
router.get('/queries/by-category', ctrl.queriesByCategory);
router.get('/queries/attention', ctrl.attentionQueue);
router.post('/queries/:id/clear-attention', ctrl.clearAttention);
router.post('/queries/merge', ctrl.mergeQueries);

// Audit log.
router.get('/audit', ctrl.audit);

export default router;
