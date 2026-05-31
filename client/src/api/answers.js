import { api } from './client.js';

export async function listAnswers(queryId) {
  const { data } = await api.get(`/queries/${queryId}/answers`);
  return data.answers;
}

export async function postAnswer(queryId, body) {
  const { data } = await api.post(`/queries/${queryId}/answers`, { body });
  return data.answer;
}

export async function likeAnswer(answerId) {
  const { data } = await api.post(`/answers/${answerId}/like`);
  return data; // { liked, like_count }
}

// Up/down vote an answer. value is 1, -1, or 0 (clear).
// Returns { value, like_count, score, liked }.
export async function voteAnswer(answerId, value) {
  const { data } = await api.post(`/answers/${answerId}/vote`, { value });
  return data;
}

export async function deleteAnswer(answerId) {
  const { data } = await api.delete(`/answers/${answerId}`);
  return data;
}

export async function addComment(answerId, body) {
  const { data } = await api.post(`/answers/${answerId}/comments`, { body });
  return data.comment;
}

export async function deleteComment(commentId) {
  const { data } = await api.delete(`/answers/comments/${commentId}`);
  return data;
}

export async function markSolution(queryId, answerId) {
  const { data } = await api.post(`/queries/${queryId}/solution`, { answerId });
  return data;
}

export async function reportQuery(queryId, reason) {
  const { data } = await api.post(`/queries/${queryId}/report`, { reason });
  return data;
}

export async function reportAnswer(answerId, reason) {
  const { data } = await api.post(`/answers/${answerId}/report`, { reason });
  return data;
}

export async function getLeaderboard() {
  const { data } = await api.get('/users/leaderboard');
  return data.users;
}
