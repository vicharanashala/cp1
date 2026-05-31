// Admin/UX fixes: status reconciliation on answer delete, admin solution
// approval, admin badge control, self-moderation guard, category endpoints.
import request from 'supertest';
import { createApp } from '../app.js';
import { setupTestDB, teardownTestDB, clearDB } from './helpers.js';
import { User } from '../models/User.js';
import { awardPoints } from '../services/badgeService.js';

const app = createApp();

beforeAll(async () => {
  await setupTestDB();
});
afterAll(async () => {
  await teardownTestDB();
});
afterEach(async () => {
  await clearDB();
});

async function makeUser(name = 'User') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email: `u${Math.random().toString(36).slice(2)}@example.com`, password: 'supersecret1' });
  return { token: res.body.accessToken, user: res.body.user };
}

async function makeAdmin() {
  const u = await makeUser('Admin');
  await User.updateOne({ _id: u.user.id }, { role: 'admin' });
  return u;
}

const authed = (req, token) => req.set('Authorization', `Bearer ${token}`);

const goodQuery = {
  title: 'How do I configure the database connection pool?',
  body: 'My Express server keeps dropping its MongoDB connection under load. What pool settings help?',
};

async function createQuery(token, over = {}) {
  const res = await authed(request(app).post('/api/queries'), token).send({ ...goodQuery, ...over });
  return res.body.query;
}

async function postAnswer(token, queryId) {
  const res = await authed(request(app).post(`/api/queries/${queryId}/answers`), token).send({
    body: 'Use a bounded connection pool and a sensible serverSelectionTimeoutMS.',
  });
  return res.body.answer;
}

describe('answer deletion reconciles query status', () => {
  test('deleting the last answer reverts the thread to open and clears the solution', async () => {
    const asker = await makeUser('Asker');
    const answerer = await makeUser('Answerer');
    const admin = await makeAdmin();

    const query = await createQuery(asker.token);
    const answer = await postAnswer(answerer.token, query.id);

    // Author accepts it → answered with an accepted answer.
    await authed(request(app).post(`/api/queries/${query.id}/solution`), asker.token).send({
      answerId: answer.id,
    });

    // Admin removes the (only) answer.
    const del = await authed(request(app).delete(`/api/answers/${answer.id}`), admin.token).send();
    expect(del.status).toBe(200);

    const after = await request(app).get(`/api/queries/${query.id}`);
    expect(after.body.query.status).toBe('open');
    expect(after.body.query.answer_count).toBe(0);
    expect(after.body.query.accepted_answer_id ?? null).toBeNull();
  });
});

describe('admin can approve any answer as the solution', () => {
  test('a non-author admin marks an answer accepted', async () => {
    const asker = await makeUser('Asker');
    const answerer = await makeUser('Answerer');
    const admin = await makeAdmin();

    const query = await createQuery(asker.token);
    const answer = await postAnswer(answerer.token, query.id);

    const res = await authed(request(app).post(`/api/queries/${query.id}/solution`), admin.token).send({
      answerId: answer.id,
    });
    expect(res.status).toBe(200);
    expect(String(res.body.accepted_answer_id)).toBe(String(answer.id));
  });
});

describe('admin self-moderation guard', () => {
  test('an admin cannot issue a moderation badge to themselves', async () => {
    const admin = await makeAdmin();
    const res = await authed(request(app).post(`/api/admin/users/${admin.user.id}/badge`), admin.token).send({
      key: 'warning',
      reason: 'test',
    });
    expect(res.status).toBe(400);
  });
});

describe('admin badge control', () => {
  test('award a custom badge then revoke it', async () => {
    const admin = await makeAdmin();
    const target = await makeUser('Target');

    const award = await authed(
      request(app).post(`/api/admin/users/${target.user.id}/custom-badge`),
      admin.token,
    ).send({ label: 'Top Contributor', icon: '🌟', reason: 'Great work' });
    expect(award.status).toBe(201);

    let profile = await request(app).get(`/api/users/${target.user.id}`);
    expect(profile.body.user.custom_badges).toHaveLength(1);
    expect(profile.body.user.custom_badges[0].label).toBe('Top Contributor');
    const key = profile.body.user.custom_badges[0].key;

    const revoke = await authed(
      request(app).delete(`/api/admin/users/${target.user.id}/custom-badge/${key}`),
      admin.token,
    ).send();
    expect(revoke.status).toBe(200);

    profile = await request(app).get(`/api/users/${target.user.id}`);
    expect(profile.body.user.custom_badges).toHaveLength(0);
  });
});

describe('expert flags a question for admin attention', () => {
  test('expert can flag, a non-expert cannot, and admin sees it in the queue', async () => {
    const asker = await makeUser('Asker');
    const expert = await makeUser('Expert');
    await awardPoints(expert.user.id, 500); // unlocks the Expert badge
    const admin = await makeAdmin();
    const query = await createQuery(asker.token);

    const denied = await authed(request(app).post(`/api/queries/${query.id}/attention`), asker.token).send();
    expect(denied.status).toBe(403);

    const flagged = await authed(request(app).post(`/api/queries/${query.id}/attention`), expert.token).send();
    expect(flagged.status).toBe(200);
    expect(flagged.body.needs_attention).toBe(true);

    const queue = await authed(request(app).get('/api/admin/queries/attention'), admin.token);
    expect(queue.status).toBe(200);
    expect(queue.body.items.some((i) => String(i.id) === String(query.id))).toBe(true);

    const cleared = await authed(
      request(app).post(`/api/admin/queries/${query.id}/clear-attention`),
      admin.token,
    ).send();
    expect(cleared.status).toBe(200);
    const after = await authed(request(app).get('/api/admin/queries/attention'), admin.token);
    expect(after.body.items).toHaveLength(0);
  });
});

describe('"user found helpful" endorsement', () => {
  test('only the asker can mark an answer helpful, and it persists on the thread', async () => {
    const asker = await makeUser('Asker');
    const answerer = await makeUser('Answerer');
    const other = await makeUser('Other');
    const query = await createQuery(asker.token);
    const answer = await postAnswer(answerer.token, query.id);

    const denied = await authed(request(app).post(`/api/answers/${answer.id}/helpful`), other.token).send();
    expect(denied.status).toBe(403);

    const marked = await authed(request(app).post(`/api/answers/${answer.id}/helpful`), asker.token).send();
    expect(marked.status).toBe(200);
    expect(marked.body.is_helpful).toBe(true);

    const list = await request(app).get(`/api/queries/${query.id}/answers`);
    expect(list.body.answers[0].is_helpful).toBe(true);
  });
});

describe('category endpoints', () => {
  test('lists distinct query categories', async () => {
    const asker = await makeUser('Asker');
    await createQuery(asker.token, { category: 'databases' });

    const res = await request(app).get('/api/queries/categories');
    expect(res.status).toBe(200);
    expect(res.body.categories).toEqual(expect.arrayContaining(['databases']));
  });

  test('admin sees queries grouped by category', async () => {
    const asker = await makeUser('Asker');
    const admin = await makeAdmin();
    await createQuery(asker.token, { category: 'databases' });

    const res = await authed(request(app).get('/api/admin/queries/by-category'), admin.token);
    expect(res.status).toBe(200);
    const row = res.body.categories.find((c) => c.category === 'databases');
    expect(row).toBeTruthy();
    expect(row.total).toBe(1);
    expect(row.open).toBe(1);
  });
});
