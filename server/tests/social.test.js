// Milestone 14 — comments, activity feed, settings, profile standing, metrics.
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

describe('comments on answers', () => {
  test('add a comment, see it in the thread, and delete it', async () => {
    const asker = await makeUser('Asker');
    const answerer = await makeUser('Answerer');
    const commenter = await makeUser('Commenter');
    const query = await createQuery(asker.token);
    const answer = await postAnswer(answerer.token, query.id);

    const added = await authed(request(app).post(`/api/answers/${answer.id}/comments`), commenter.token).send({
      body: 'Have you tried raising the pool size?',
    });
    expect(added.status).toBe(201);
    expect(added.body.comment.body).toBe('Have you tried raising the pool size?');

    const list = await request(app).get(`/api/queries/${query.id}/answers`);
    expect(list.body.answers[0].comments).toHaveLength(1);

    const del = await authed(
      request(app).delete(`/api/answers/comments/${added.body.comment.id}`),
      commenter.token,
    ).send();
    expect(del.status).toBe(200);

    const after = await request(app).get(`/api/queries/${query.id}/answers`);
    expect(after.body.answers[0].comments).toHaveLength(0);
  });
});

describe('activity feed', () => {
  test('aggregates the user\'s asked / answered / saved items', async () => {
    const me = await makeUser('Me');
    const other = await makeUser('Other');
    await createQuery(me.token); // asked
    const theirs = await createQuery(other.token, {
      title: 'Why does my React useEffect run twice in development?',
      body: 'In React 18 strict mode my effect fires twice on mount and double-fetches. How do I handle this correctly?',
    });
    await postAnswer(me.token, theirs.id); // answered
    await authed(request(app).post(`/api/queries/${theirs.id}/save`), me.token).send(); // saved

    const res = await authed(request(app).get('/api/users/me/activity'), me.token);
    expect(res.status).toBe(200);
    const types = res.body.items.map((i) => i.type);
    expect(types).toEqual(expect.arrayContaining(['question', 'answer', 'saved']));
  });
});

describe('settings (PATCH /users/me)', () => {
  test('updates the display name and notification preferences', async () => {
    const me = await makeUser('Original Name');
    const res = await authed(request(app).patch('/api/users/me'), me.token).send({
      name: 'Renamed',
      notification_prefs: { answers: false, mentions: true, system: false },
    });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Renamed');
    expect(res.body.user.notification_prefs).toEqual({ answers: false, mentions: true, system: false });
  });
});

describe('profile standing + metrics', () => {
  test('profile exposes a reputation tier that tracks points', async () => {
    const u = await makeUser('Climber');
    let res = await request(app).get(`/api/users/${u.user.id}`);
    expect(res.body.user.standing.tier.label).toBe('Newcomer');

    await awardPoints(u.user.id, 60);
    res = await request(app).get(`/api/users/${u.user.id}`);
    expect(res.body.user.standing.tier.label).toBe('Helper');
    expect(res.body.user.standing.next.label).toBe('Contributor');
  });

  test('admin metrics include a resolution rate', async () => {
    const admin = await makeAdmin();
    const res = await authed(request(app).get('/api/admin/metrics'), admin.token);
    expect(res.status).toBe(200);
    expect(typeof res.body.resolution_rate).toBe('number');
  });
});
