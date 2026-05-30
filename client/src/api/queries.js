import { api } from './client.js';

// List queries with optional filters: { category, tag, status, q, page, limit }.
export async function listQueries(params = {}) {
  const { data } = await api.get('/queries', { params });
  return data;
}

export async function getQuery(id) {
  const { data } = await api.get(`/queries/${id}`);
  return data.query;
}

/**
 * Create a query. Sends multipart/form-data so screenshots can ride along.
 * `fields` may include title, body, category, tags, is_anonymous, contact_email,
 * original_body, post_anyway. `screenshots` is a FileList / File[].
 */
export async function createQuery(fields, screenshots = []) {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') form.append(key, value);
  });
  Array.from(screenshots).forEach((file) => form.append('screenshots', file));
  const { data } = await api.post('/queries', form);
  return data.query;
}

export async function updateQuery(id, fields) {
  const { data } = await api.patch(`/queries/${id}`, fields);
  return data.query;
}

export async function deleteQuery(id) {
  const { data } = await api.delete(`/queries/${id}`);
  return data;
}

export async function checkGrammar(text) {
  const { data } = await api.post('/queries/check-grammar', { text });
  return data;
}

// Up/down vote a question. value is 1, -1, or 0 (clear). Returns { vote_score, my_vote }.
export async function voteQuery(id, value) {
  const { data } = await api.post(`/queries/${id}/vote`, { value });
  return data;
}

// Toggle a bookmark on a question. Returns { saved }.
export async function saveQuery(id) {
  const { data } = await api.post(`/queries/${id}/save`);
  return data;
}

// The current user's bookmarked questions.
export async function getBookmarks() {
  const { data } = await api.get('/queries/bookmarks');
  return data.items;
}
