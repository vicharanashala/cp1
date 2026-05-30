import * as chatbotService from '../services/chatbotService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const ask = asyncHandler(async (req, res) => {
  const result = await chatbotService.ask({
    sessionToken: req.body?.session_token,
    userId: req.userId ?? null,
    message: req.body?.message,
  });
  res.json(result);
});

export const session = asyncHandler(async (req, res) => {
  const result = await chatbotService.getSession(req.params.token, req.userId ?? null);
  res.json(result);
});
