import { api } from './client.js';

export async function getProfile(id) {
  const { data } = await api.get(`/users/${id}`);
  return data.user;
}

export async function banUser(id, { hours, reason }) {
  const { data } = await api.post(`/admin/users/${id}/ban`, { hours, reason });
  return data;
}

export async function unbanUser(id) {
  const { data } = await api.post(`/admin/users/${id}/unban`);
  return data;
}

export async function issueNegativeBadge(id, key, reason) {
  const { data } = await api.post(`/admin/users/${id}/badge`, { key, reason });
  return data;
}
