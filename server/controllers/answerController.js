import * as answerService from '../services/answerService.js';
import * as solutionService from '../services/solutionService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const post = asyncHandler(async (req, res) => {
  const answer = await answerService.postAnswer(req.user, req.params.queryId, req.body?.body);
  res.status(201).json({ answer });
});

export const list = asyncHandler(async (req, res) => {
  const answers = await answerService.listAnswers(req.params.queryId, req.userId);
  res.json({ answers });
});

export const like = asyncHandler(async (req, res) => {
  const result = await answerService.toggleLike(req.user, req.params.id);
  res.json(result);
});

export const vote = asyncHandler(async (req, res) => {
  const result = await answerService.setAnswerVote(req.user, req.params.id, Number(req.body?.value));
  res.json(result);
});

export const comment = asyncHandler(async (req, res) => {
  const result = await answerService.addComment(req.user, req.params.id, req.body?.body);
  res.status(201).json({ comment: result });
});

export const deleteComment = asyncHandler(async (req, res) => {
  const result = await answerService.deleteComment(req.user, req.params.commentId);
  res.json(result);
});

export const remove = asyncHandler(async (req, res) => {
  const result = await answerService.deleteAnswer(req.user, req.params.id);
  res.json(result);
});

export const reportAnswer = asyncHandler(async (req, res) => {
  const result = await answerService.reportContent(req.user, {
    targetType: 'answer',
    targetId: req.params.id,
    reason: req.body?.reason,
  });
  res.json(result);
});

export const reportQuery = asyncHandler(async (req, res) => {
  const result = await answerService.reportContent(req.user, {
    targetType: 'query',
    targetId: req.params.id,
    reason: req.body?.reason,
  });
  res.json(result);
});

export const markSolution = asyncHandler(async (req, res) => {
  const result = await solutionService.markSolution(req.user, req.params.id, req.body?.answerId);
  res.json(result);
});
