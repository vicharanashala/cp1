import mongoose from 'mongoose';

const likeSchema = new mongoose.Schema(
  {
    answer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Answer', required: true, index: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // +1 = upvote (the reputation-bearing "like"), -1 = downvote. Defaults to an
    // upvote so the legacy /like flow and existing rows keep working unchanged.
    value: { type: Number, enum: [1, -1], default: 1 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// One like per user per answer.
likeSchema.index({ answer_id: 1, user_id: 1 }, { unique: true });

export const Like = mongoose.model('Like', likeSchema);
export default Like;
