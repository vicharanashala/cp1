import mongoose from 'mongoose';

// Up/down vote on a Query (the forum-card "votes" score). Answers use the Like
// model; questions use this. One vote per user per query.
const voteSchema = new mongoose.Schema(
  {
    query_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Query', required: true, index: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    value: { type: Number, enum: [1, -1], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

voteSchema.index({ query_id: 1, user_id: 1 }, { unique: true });

export const Vote = mongoose.model('Vote', voteSchema);
export default Vote;
