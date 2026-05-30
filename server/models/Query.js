import mongoose from 'mongoose';
import { QUERY_STATUS, EMBEDDING_DIMS } from '../config/constants.js';

const reportSchema = new mongoose.Schema(
  {
    reporter_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String,
    created_at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const querySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    author_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    is_anonymous: { type: Boolean, default: false },

    status: { type: String, enum: Object.values(QUERY_STATUS), default: QUERY_STATUS.OPEN, index: true },
    category: { type: String, default: 'general', index: true },
    tags: { type: [String], default: [] },

    // Admin verification.
    is_verified: { type: Boolean, default: false },
    verified_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Context enrichment.
    contact_email: { type: String, default: null },
    screenshots: { type: [String], default: [] }, // relative upload paths

    // Auto-correction (opt-in) — original preserved when the body was corrected.
    original_body: { type: String, default: null },
    was_auto_corrected: { type: Boolean, default: false },

    // Duplicate / merge handling.
    is_flagged_duplicate: { type: Boolean, default: false },
    duplicate_of: { type: mongoose.Schema.Types.ObjectId, ref: 'Query', default: null },
    similarity_score: { type: Number, default: null },
    merge_status: { type: String, enum: ['none', 'pending', 'merged'], default: 'none' },
    merged_into: { type: mongoose.Schema.Types.ObjectId, ref: 'Query', default: null },
    merged_from: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Query' }], default: [] },

    reports: { type: [reportSchema], default: [] },

    // Community voting (net up/down score; individual votes live in `votes`).
    vote_score: { type: Number, default: 0 },

    // LRU.
    last_accessed_at: { type: Date, default: Date.now },
    access_count: { type: Number, default: 0 },
    is_archived: { type: Boolean, default: false },

    // Semantic search / duplicate detection.
    embedding: { type: [Number], default: undefined, validate: (v) => !v || v.length === EMBEDDING_DIMS },
    // Hash of the exact text last embedded — lets us skip re-embedding unchanged content.
    embedding_hash: { type: String, default: null },

    // Solution timing.
    grace_period_deadline: { type: Date, default: null },
    first_answered_at: { type: Date, default: null },
    accepted_answer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Answer', default: null },

    // Soft delete.
    is_deleted: { type: Boolean, default: false },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: true },
);

querySchema.index({ title: 'text', body: 'text' });

export const Query = mongoose.model('Query', querySchema);
export default Query;
