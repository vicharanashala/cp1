import request from 'supertest';
import { createApp } from '../app.js';
import { setupTestDB, teardownTestDB, clearDB } from './helpers.js';
import { User } from '../models/User.js';
import { Answer } from '../models/Answer.js';
import { ModerationQueue } from '../models/ModerationQueue.js';
import { POINTS } from '../config/constants.js';

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

async function makeUser(overrides = {}) {
  const payload = {
    name: 'User',
    email: `u${Math.random().toString(36).slice(2)}@example.com`,
    password: 'supersecret1',
    ...overrides,
  };
  const res = await request(app).post('/api/auth/register').send(payload);
  return { token: res.body.accessToken, user: res.body.user };
}

async function makeAdmin() {
  const { token, user } = await makeUser({ name: 'Admin' });
  await User.updateOne({ _id: user.id }, { role: 'admin' });
  return { token, user };
}

const authed = (req, token) => req.set('Authorization', `Bearer ${token}`);

const goodQuery = {
  title: 'How do I configure the database connection?',
  body: 'My Express server cannot connect to MongoDB in production. What settings should I use to avoid timeouts?',
};

async function createQuery(token) {
  const res = await authed(request(app).post('/api/queries'), token).send(goodQuery);
  return res.body.query;
}

async function runFinalize(adminToken) {
  return authed(request(app).post('/api/jobs/finalize-solutions/run'), adminToken).send();
}

describe('answers + likes', () => {
  test('posting an answer flips the query to answered and notifies the author', async () => {
    const asker = await makeUser();
    const answerer = await makeUser();
    const query = await createQuery(asker.token);

    const res = await authed(
      request(app).post(`/api/queries/${query.id}/answers`),
      answerer.token,
    ).send({ body: 'Set serverSelectionTimeoutMS and use a connection pool.' });
    expect(res.status).toBe(201);

    const detail = await request(app).get(`/api/queries/${query.id}`);
    expect(detail.body.query.status).toBe('answered');

    const count = await authed(request(app).get('/api/notifications/unread-count'), asker.token).send();
    expect(count.body.count).toBe(1);
  });

  test('like toggles, awards author points, and forbids self-likes', async () => {
    const asker = await makeUser();
    const answerer = await makeUser();
    const query = await createQuery(asker.token);
    const posted = await authed(
      request(app).post(`/api/queries/${query.id}/answers`),
      answerer.token,
    ).send({ body: 'Use a connection pool and a sensible timeout.' });
    const answerId = posted.body.answer.id;

    const selfLike = await authed(request(app).post(`/api/answers/${answerId}/like`), answerer.token).send();
    expect(selfLike.status).toBe(400);

    const liked = await authed(request(app).post(`/api/answers/${answerId}/like`), asker.token).send();
    expect(liked.body).toEqual({ liked: true, like_count: 1 });
    let author = await User.findById(answerer.user.id);
    expect(author.points).toBe(POINTS.ANSWER_LIKED);

    const unliked = await authed(request(app).post(`/api/answers/${answerId}/like`), asker.token).send();
    expect(unliked.body).toEqual({ liked: false, like_count: 0 });
    author = await User.findById(answerer.user.id);
    expect(author.points).toBe(0);
  });
});

describe('solution engine', () => {
  test('Path A: author marks → finalize resolves, prunes extras, awards points', async () => {
    const asker = await makeUser();
    const answerer = await makeUser();
    const admin = await makeAdmin();
    const query = await createQuery(asker.token);

    // Four answers from the answerer; only three should survive resolution.
    let acceptedId;
    for (let i = 0; i < 4; i++) {
      const r = await authed(
        request(app).post(`/api/queries/${query.id}/answers`),
        answerer.token,
      ).send({ body: `Candidate answer number ${i} with enough detail to be valid.` });
      if (i === 0) acceptedId = r.body.answer.id;
    }

    // Non-author cannot mark a solution.
    const forbidden = await authed(
      request(app).post(`/api/queries/${query.id}/solution`),
      answerer.token,
    ).send({ answerId: acceptedId });
    expect(forbidden.status).toBe(403);

    const marked = await authed(
      request(app).post(`/api/queries/${query.id}/solution`),
      asker.token,
    ).send({ answerId: acceptedId });
    expect(marked.status).toBe(200);
    expect(marked.body.grace_period_deadline).toBeTruthy();

    const fin = await runFinalize(admin.token);
    expect(fin.status).toBe(200);
    expect(fin.body.result.resolved).toBe(1);
    expect(fin.body.result.pruned).toBe(1); // 4 → keep 3

    const detail = await request(app).get(`/api/queries/${query.id}`);
    expect(detail.body.query.status).toBe('resolved');
    expect(String(detail.body.query.accepted_answer_id)).toBe(acceptedId);

    const surviving = await Answer.countDocuments({ query_id: query.id, is_deleted: false });
    expect(surviving).toBe(3);

    const author = await User.findById(answerer.user.id);
    const askerDoc = await User.findById(asker.user.id);
    expect(author.points).toBe(POINTS.ANSWER_ACCEPTED);
    // Asking a question never earns points — only the answerer is rewarded.
    expect(askerDoc.points).toBe(0);
  });

  test('Path B: no selection → finalize auto-keeps most liked with no points', async () => {
    const asker = await makeUser();
    const answerer = await makeUser();
    const admin = await makeAdmin();
    const query = await createQuery(asker.token);

    await authed(request(app).post(`/api/queries/${query.id}/answers`), answerer.token).send({
      body: 'A solid answer that nobody explicitly accepted as the solution.',
    });

    const fin = await runFinalize(admin.token);
    expect(fin.body.result.resolved).toBe(1);

    const detail = await request(app).get(`/api/queries/${query.id}`);
    expect(detail.body.query.status).toBe('resolved');

    const author = await User.findById(answerer.user.id);
    expect(author.points).toBe(0); // Path B awards nothing
  });

  test('job triggers are admin-only', async () => {
    const { token } = await makeUser();
    const res = await authed(request(app).post('/api/jobs/finalize-solutions/run'), token).send();
    expect(res.status).toBe(403);
  });
});

describe('reporting + leaderboard', () => {
  test('reporting a query files a moderation entry', async () => {
    const asker = await makeUser();
    const reporter = await makeUser();
    const query = await createQuery(asker.token);

    const res = await authed(request(app).post(`/api/queries/${query.id}/report`), reporter.token).send({
      reason: 'Looks like spam',
    });
    expect(res.status).toBe(200);

    const queued = await ModerationQueue.find({ type: 'report' });
    expect(queued).toHaveLength(1);
    expect(String(queued[0].query_id)).toBe(query.id);
  });

  test('leaderboard ranks users by points', async () => {
    const asker = await makeUser();
    const answerer = await makeUser({ name: 'Top Helper' });
    const query = await createQuery(asker.token);
    const posted = await authed(
      request(app).post(`/api/queries/${query.id}/answers`),
      answerer.token,
    ).send({ body: 'A genuinely helpful and well-explained answer here.' });
    await authed(request(app).post(`/api/answers/${posted.body.answer.id}/like`), asker.token).send();

    const res = await request(app).get('/api/users/leaderboard');
    expect(res.status).toBe(200);
    expect(res.body.users[0].name).toBe('Top Helper');
    expect(res.body.users[0].points).toBe(POINTS.ANSWER_LIKED);
    expect(res.body.users[0].rank).toBe(1);
  });
});
