import mongoose from 'mongoose';

// A short threaded comment on an answer (lightweight discussion under an answer,
// distinct from a full answer). Soft-deleted with the rest of the system.
const commentSchema = new mongoose.Schema(
  {
    answer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Answer', required: true, index: true },
    author_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 1000 },
    is_deleted: { type: Boolean, default: false },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Comment = mongoose.model('Comment', commentSchema);
export default Comment;
