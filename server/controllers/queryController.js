import * as queryService from '../services/queryService.js';
import { uploadedPaths } from '../middleware/upload.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const create = asyncHandler(async (req, res) => {
  const query = await queryService.createQuery(req.user, req.body, uploadedPaths(req));
  res.status(201).json({ query });
});

export const list = asyncHandler(async (req, res) => {
  const result = await queryService.listQueries(req.query, req.userId);
  res.json(result);
});

export const detail = asyncHandler(async (req, res) => {
  const query = await queryService.getQuery(req.params.id, req.userId);
  res.json({ query });
});

export const update = asyncHandler(async (req, res) => {
  const query = await queryService.updateQuery(req.user, req.params.id, req.body);
  res.json({ query });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await queryService.deleteQuery(req.user, req.params.id);
  res.json(result);
});

export const checkGrammar = asyncHandler(async (req, res) => {
  const result = await queryService.checkGrammar(req.body?.text);
  res.json(result);
});

export const vote = asyncHandler(async (req, res) => {
  const result = await queryService.voteQuery(req.user, req.params.id, req.body?.value);
  res.json(result);
});

export const save = asyncHandler(async (req, res) => {
  const result = await queryService.toggleBookmark(req.user, req.params.id);
  res.json(result);
});

export const bookmarks = asyncHandler(async (req, res) => {
  const result = await queryService.listBookmarks(req.user);
  res.json(result);
});
