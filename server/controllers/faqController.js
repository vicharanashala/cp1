import * as faqService from '../services/faqService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const list = asyncHandler(async (req, res) => {
  const groups = await faqService.listFaqs({ category: req.query.category });
  res.json({ groups });
});

export const search = asyncHandler(async (req, res) => {
  const results = await faqService.searchFaqs(req.query.q);
  res.json({ results });
});

export const promote = asyncHandler(async (req, res) => {
  const entry = await faqService.promoteQueryToFaq(req.params.queryId);
  res.status(201).json({ entry });
});
