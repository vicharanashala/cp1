import * as userService from '../services/userService.js';
import * as adminService from '../services/adminService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const banUser = asyncHandler(async (req, res) => {
  const result = await userService.banUser(req.user, req.params.id, {
    hours: req.body?.hours,
    reason: req.body?.reason,
  });
  res.json(result);
});

export const unbanUser = asyncHandler(async (req, res) => {
  const result = await userService.unbanUser(req.user, req.params.id);
  res.json(result);
});

export const issueNegativeBadge = asyncHandler(async (req, res) => {
  const result = await userService.issueNegativeBadge(
    req.user,
    req.params.id,
    req.body?.key,
    req.body?.reason,
  );
  res.json(result);
});

export const revokeNegativeBadge = asyncHandler(async (req, res) => {
  res.json(await userService.revokeNegativeBadge(req.user, req.params.id, req.params.key));
});

export const awardCustomBadge = asyncHandler(async (req, res) => {
  const result = await userService.awardCustomBadge(req.user, req.params.id, {
    label: req.body?.label,
    icon: req.body?.icon,
    reason: req.body?.reason,
  });
  res.status(201).json(result);
});

export const revokeCustomBadge = asyncHandler(async (req, res) => {
  res.json(await userService.revokeCustomBadge(req.user, req.params.id, req.params.key));
});

export const queriesByCategory = asyncHandler(async (_req, res) => {
  res.json({ categories: await adminService.queriesByCategory() });
});

export const attentionQueue = asyncHandler(async (_req, res) => {
  res.json({ items: await adminService.listAttentionQueries() });
});

export const clearAttention = asyncHandler(async (req, res) => {
  res.json(await adminService.clearAttention(req.user, req.params.id));
});

export const metrics = asyncHandler(async (_req, res) => {
  res.json(await adminService.getMetrics());
});

export const listUsers = asyncHandler(async (req, res) => {
  res.json(await adminService.listUsers(req.query));
});

export const setRole = asyncHandler(async (req, res) => {
  res.json(await adminService.setRole(req.user, req.params.id, req.body?.role));
});

export const listModeration = asyncHandler(async (req, res) => {
  res.json(await adminService.listModeration(req.query));
});

export const resolveModeration = asyncHandler(async (req, res) => {
  res.json(await adminService.resolveModeration(req.user, req.params.id, req.body?.note));
});

export const dismissModeration = asyncHandler(async (req, res) => {
  res.json(await adminService.dismissModeration(req.user, req.params.id, req.body?.note));
});

export const mergeQueries = asyncHandler(async (req, res) => {
  res.json(
    await adminService.mergeQueries(req.user, {
      canonicalId: req.body?.canonicalId,
      duplicateId: req.body?.duplicateId,
      moderationId: req.body?.moderationId,
    }),
  );
});

export const queryClusters = asyncHandler(async (_req, res) => {
  res.json({ clusters: await adminService.findQueryClusters() });
});

export const audit = asyncHandler(async (req, res) => {
  res.json(await adminService.listAudit(req.query));
});
