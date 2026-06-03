import request from 'supertest';
import { createApp } from '../app.js';
import { setupTestDB, teardownTestDB, clearDB } from './helpers.js';
import { User } from '../models/User.js';
import { ModerationQueue } from '../models/ModerationQueue.js';

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
    name: 'Grace Hopper',
    email: `grace${Math.random().toString(36).slice(2)}@example.com`,
    password: 'supersecret1',
    ...overrides,
  };
  const res = await request(app).post('/api/auth/register').send(payload);
  return { token: res.body.accessToken, user: res.body.user };
}

const authed = (req, token) => req.set('Authorization', `Bearer ${token}`);

const goodQuery = {
  title: 'How do I configure the database connection?',
  body: 'I am trying to connect my Express server to MongoDB but the connection keeps timing out. What configuration should I use for production?',
  category: 'technical',
  tags: 'urgent, question',
  contact_email: 'asker@example.com',
  joining_date: '2024-01-15',
};

describe('query intake', () => {
  test('creates a valid query and returns it', async () => {
    const { token } = await makeUser();
    const res = await authed(request(app).post('/api/queries'), token).send(goodQuery);
    expect(res.status).toBe(201);
    expect(res.body.query.title).toBe(goodQuery.title);
    expect(res.body.query.tags).toEqual(['urgent', 'question']);
    expect(res.body.query.is_owner).toBe(true);
    expect(res.body.query.embedding).toBeUndefined(); // never leaked
  });

  test('requires authentication', async () => {
    const res = await request(app).post('/api/queries').send(goodQuery);
    expect(res.status).toBe(401);
  });

  test('blocks gibberish and escalates spam to a ban on the second strike', async () => {
    const { token, user } = await makeUser();
    const gibberish = {
      title: 'asdf qwer zxcv',
      body: 'asdfgh qwerty zxcvbn hjkl bnm asdf qwer zxcv hjkl',
    };

    const first = await authed(request(app).post('/api/queries'), token).send(gibberish);
    expect(first.status).toBe(422);
    expect(first.body.details.gibberish).toBe(true);
    expect(first.body.details.spam_flag_count).toBe(1);
    expect(first.body.details.penalty).toBe('warning');

    const second = await authed(request(app).post('/api/queries'), token).send(gibberish);
    expect(second.status).toBe(422);
    expect(second.body.details.spam_flag_count).toBe(2);
    expect(second.body.details.penalty).toBe('banned_24h');

    const dbUser = await User.findById(user.id);
    expect(dbUser.is_banned).toBe(true);
    expect(dbUser.negative_badges.some((b) => b.key === 'warning')).toBe(true);

    // Banned users are blocked from posting (even valid content).
    const blocked = await authed(request(app).post('/api/queries'), token).send(goodQuery);
    expect(blocked.status).toBe(403);
  });

  test('warns on a near-duplicate, then flags + queues it when posted anyway', async () => {
    const { token } = await makeUser();
    await authed(request(app).post('/api/queries'), token).send(goodQuery);

    const warned = await authed(request(app).post('/api/queries'), token).send(goodQuery);
    expect(warned.status).toBe(409);
    expect(warned.body.details.duplicate).toBe(true);
    expect(warned.body.details.matches[0].score).toBeGreaterThan(0.8);

    const forced = await authed(request(app).post('/api/queries'), token).send({
      ...goodQuery,
      post_anyway: true,
    });
    expect(forced.status).toBe(201);
    expect(forced.body.query.is_flagged_duplicate).toBe(true);

    const queued = await ModerationQueue.find({ type: 'duplicate' });
    expect(queued).toHaveLength(1);
  });

  test('always attributes the author — anonymous posting is disabled', async () => {
    const { token, user } = await makeUser();
    // Even if a client tries to force anonymity, the author is still attributed.
    await authed(request(app).post('/api/queries'), token).send({ ...goodQuery, is_anonymous: true });

    const res = await request(app).get('/api/queries');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].is_anonymous).toBe(false);
    expect(res.body.items[0].author.name).toBe(user.name);
    expect(res.body.items[0].author.id).toBeDefined();
  });

  test('author can soft-delete; others cannot', async () => {
    const { token } = await makeUser();
    const created = await authed(request(app).post('/api/queries'), token).send(goodQuery);
    const id = created.body.query.id;

    const { token: otherToken } = await makeUser();
    const forbidden = await authed(request(app).delete(`/api/queries/${id}`), otherToken).send();
    expect(forbidden.status).toBe(403);

    const ok = await authed(request(app).delete(`/api/queries/${id}`), token).send();
    expect(ok.status).toBe(200);

    const gone = await request(app).get(`/api/queries/${id}`);
    expect(gone.status).toBe(404);
  });

  test('rejects a category not in the admin taxonomy', async () => {
    const { token } = await makeUser();
    const res = await authed(request(app).post('/api/queries'), token).send({
      ...goodQuery,
      category: 'totally-made-up',
    });
    expect(res.status).toBe(400);
  });

  test('rejects a self-invented tag but allows the built-in "others" tag', async () => {
    const { token } = await makeUser();

    const bad = await authed(request(app).post('/api/queries'), token).send({
      ...goodQuery,
      tags: 'my-custom-tag',
    });
    expect(bad.status).toBe(400);

    const ok = await authed(request(app).post('/api/queries'), token).send({
      ...goodQuery,
      tags: 'others',
    });
    expect(ok.status).toBe(201);
    expect(ok.body.query.tags).toEqual(['others']);
  });

  test('rejects a question posted without a joining date', async () => {
    const { token } = await makeUser();
    // eslint-disable-next-line no-unused-vars
    const { joining_date, ...noJoining } = goodQuery;
    const res = await authed(request(app).post('/api/queries'), token).send(noJoining);
    expect(res.status).toBe(400);
  });

  test('captures the asker joining date and contact email', async () => {
    const { token } = await makeUser();
    const res = await authed(request(app).post('/api/queries'), token).send(goodQuery);
    expect(res.status).toBe(201);
    expect(res.body.query.contact_email).toBe('asker@example.com');
    expect(new Date(res.body.query.joining_date).toISOString().slice(0, 10)).toBe('2024-01-15');
  });

  test('refine with AI returns a tidied suggestion', async () => {
    const { token } = await makeUser();
    const res = await authed(request(app).post('/api/queries/refine'), token).send({
      text: 'how do i reset my password',
    });
    expect(res.status).toBe(200);
    expect(res.body.has_changes).toBe(true);
    expect(res.body.corrected).toBe('How do I reset my password.');
  });

  test('blocks an unfinished question without a spam strike', async () => {
    const { token, user } = await makeUser();
    const res = await authed(request(app).post('/api/queries'), token).send({
      ...goodQuery,
      title: 'Help',
      body: 'thanks',
    });
    expect(res.status).toBe(422);
    expect(res.body.details.incomplete).toBe(true);
    expect(res.body.details.reasons.length).toBeGreaterThan(0);

    // Unlike gibberish, an honest unfinished post is not a spam strike.
    const dbUser = await User.findById(user.id);
    expect(dbUser.spam_flag_count ?? 0).toBe(0);
  });

  test('flags a blocked gibberish attempt to the moderation queue', async () => {
    const { token } = await makeUser();
    const res = await authed(request(app).post('/api/queries'), token).send({
      title: 'asdf qwer zxcv',
      body: 'asdfgh qwerty zxcvbn hjkl bnm asdf qwer zxcv hjkl',
    });
    expect(res.status).toBe(422);

    const flagged = await ModerationQueue.find({ type: 'gibberish' });
    expect(flagged).toHaveLength(1);
    expect(String(flagged[0].reason)).toContain('Gibberish');
  });
});
