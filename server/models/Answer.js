import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    reporter_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String,
    created_at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const answerSchema = new mongoose.Schema(
  {
    query_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Query', required: true, index: true },
    author_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    body: { type: String, required: true },

    like_count: { type: Number, default: 0 },
    is_accepted: { type: Boolean, default: false },

    // Endorsement by the question author — distinct from the single accepted
    // solution; multiple answers can be marked "helpful" and it stays on the thread.
    is_helpful: { type: Boolean, default: false },
    helpful_at: { type: Date, default: null },

    // Admin verification.
    is_verified: { type: Boolean, default: false },
    verified_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Auto-correction (opt-in).
    original_body: { type: String, default: null },
    was_auto_corrected: { type: Boolean, default: false },

    // Staleness.
    is_outdated: { type: Boolean, default: false },

    reports: { type: [reportSchema], default: [] },

    is_deleted: { type: Boolean, default: false },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Answer = mongoose.model('Answer', answerSchema);
export default Answer;
