import { api } from './client.js';

export async function getMetrics() {
  const { data } = await api.get('/admin/metrics');
  return data;
}

export async function getHealth() {
  const { data } = await api.get('/health');
  return data;
}

export async function listUsers(params = {}) {
  const { data } = await api.get('/admin/users', { params });
  return data;
}

export async function setRole(id, role) {
  const { data } = await api.post(`/admin/users/${id}/role`, { role });
  return data;
}

export async function banUser(id, { hours, reason }) {
  const { data } = await api.post(`/admin/users/${id}/ban`, { hours, reason });
  return data;
}

export async function unbanUser(id) {
  const { data } = await api.post(`/admin/users/${id}/unban`);
  return data;
}

export async function listModeration(params = {}) {
  const { data } = await api.get('/admin/moderation', { params });
  return data;
}

export async function resolveModeration(id, note) {
  const { data } = await api.post(`/admin/moderation/${id}/resolve`, { note });
  return data;
}

export async function dismissModeration(id, note) {
  const { data } = await api.post(`/admin/moderation/${id}/dismiss`, { note });
  return data;
}

export async function getClusters() {
  const { data } = await api.get('/admin/queries/clusters');
  return data.clusters;
}

export async function mergeQueries(payload) {
  const { data } = await api.post('/admin/queries/merge', payload);
  return data;
}

export async function getAudit(params = {}) {
  const { data } = await api.get('/admin/audit', { params });
  return data;
}

// Maintenance jobs (registry + manual trigger).
export async function listJobs() {
  const { data } = await api.get('/jobs');
  return data.jobs;
}

export async function runJob(name) {
  const { data } = await api.post(`/jobs/${name}/run`);
  return data;
}

// FAQ management.
export async function createFaq(payload) {
  const { data } = await api.post('/faq', payload);
  return data.entry;
}

export async function updateFaq(id, payload) {
  const { data } = await api.patch(`/faq/${id}`, payload);
  return data.entry;
}

export async function setFaqOutdated(id, isOutdated) {
  const { data } = await api.post(`/faq/${id}/outdated`, { is_outdated: isOutdated });
  return data.entry;
}

export async function deleteFaq(id) {
  const { data } = await api.delete(`/faq/${id}`);
  return data;
}
