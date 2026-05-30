import mongoose from 'mongoose';

// A user's saved/bookmarked query. One bookmark per user per query.
const bookmarkSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    query_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Query', required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

bookmarkSchema.index({ user_id: 1, query_id: 1 }, { unique: true });

export const Bookmark = mongoose.model('Bookmark', bookmarkSchema);
export default Bookmark;
