import { Router } from 'express';
import authRoutes from './authRoutes.js';
import queryRoutes from './queryRoutes.js';
import answerRoutes from './answerRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import userRoutes from './userRoutes.js';
import adminRoutes from './adminRoutes.js';
import faqRoutes from './faqRoutes.js';
import chatbotRoutes from './chatbotRoutes.js';
import jobRoutes from './jobRoutes.js';
import { ai } from '../config/ai.js';
import mongoose from 'mongoose';

const router = Router();

// Health/status — handy for Docker healthchecks and the CI smoke test.
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    ai: ai.mockMode ? 'mock' : 'live',
    uptime_seconds: Math.round(process.uptime()),
    time: new Date().toISOString(),
  });
});

router.use('/auth', authRoutes);
router.use('/queries', queryRoutes);
router.use('/answers', answerRoutes);
router.use('/notifications', notificationRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);
router.use('/faq', faqRoutes);
router.use('/chatbot', chatbotRoutes);
router.use('/jobs', jobRoutes);

export default router;
