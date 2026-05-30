// Security regression suite. Each test pins a specific vulnerability fixed
// during the QA & security audit so it can't silently regress.
import request from 'supertest';
import { createApp } from '../app.js';
import { setupTestDB, teardownTestDB, clearDB } from './helpers.js';
import { User } from '../models/User.js';

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
  title: 'How do I configure the database connection pool?',
  body: 'My Express server keeps dropping its MongoDB connection under load. What pool settings are recommended for production deployments?',
  category: 'general',
};

describe('security: baseline response headers', () => {
  test('sets hardening headers and hides X-Powered-By', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('security: NoSQL operator injection on list filters', () => {
  test('a query-string operator object is neutralized (treated as a string)', async () => {
    const { token } = await makeUser();
    await authed(request(app).post('/api/queries'), token).send(goodQuery);

    // Sanity: the query is visible under its real category.
    const ok = await request(app).get('/api/queries?category=general');
    expect(ok.body.total).toBe(1);

    // Attack: `category[$ne]=nope` would, without coercion, match everything
    // NOT in category "nope" (i.e. leak the query). After coercion the operator
    // object stringifies and matches nothing.
    const injected = await request(app).get('/api/queries?category[$ne]=nope');
    expect(injected.status).toBe(200);
    expect(injected.body.total).toBe(0);
  });
});

describe('security: upload filename cannot smuggle an executable extension', () => {
  test('an image/png upload named evil.html is stored with a .png extension', async () => {
    const { token } = await makeUser();
    const res = await authed(request(app).post('/api/queries'), token)
      .field('title', goodQuery.title)
      .field('body', goodQuery.body)
      .field('category', 'general')
      .attach('screenshots', Buffer.from('fake-png-bytes'), {
        filename: 'evil.html',
        contentType: 'image/png',
      });

    expect(res.status).toBe(201);
    expect(res.body.query.screenshots).toHaveLength(1);
    const stored = res.body.query.screenshots[0];
    expect(stored).toMatch(/\.png$/);
    expect(stored).not.toMatch(/\.html$/);
  });
});

describe('security: chatbot session ownership', () => {
  test("a user's session history is not readable by others, and tokens can't be hijacked", async () => {
    const alice = await makeUser({ name: 'Alice' });
    const bob = await makeUser({ name: 'Bob' });

    // Alice (logged in) starts a session.
    const ask = await authed(request(app).post('/api/chatbot/ask'), alice.token).send({
      message: 'How do I reset my password?',
    });
    expect(ask.status).toBe(200);
    const token = ask.body.session_token;
    expect(token).toBeTruthy();

    // Bob cannot read Alice's session.
    const bobRead = await authed(
      request(app).get(`/api/chatbot/session/${token}`),
      bob.token,
    );
    expect(bobRead.status).toBe(403);

    // Anonymous cannot read it either.
    const anonRead = await request(app).get(`/api/chatbot/session/${token}`);
    expect(anonRead.status).toBe(403);

    // Bob replaying Alice's token does NOT append to her session — he gets a
    // fresh session token instead.
    const bobAsk = await authed(request(app).post('/api/chatbot/ask'), bob.token).send({
      message: 'hijack attempt',
      session_token: token,
    });
    expect(bobAsk.body.session_token).not.toBe(token);

    // Alice can still read her own session, and it only has her exchange.
    const aliceRead = await authed(
      request(app).get(`/api/chatbot/session/${token}`),
      alice.token,
    );
    expect(aliceRead.status).toBe(200);
    expect(aliceRead.body.messages).toHaveLength(2); // her 1 question + 1 reply
  });
});

describe('security: banned users cannot report content', () => {
  test('banCheck blocks a banned user from flooding the moderation queue', async () => {
    const admin = await makeAdmin();
    const target = await makeUser();
    const reporter = await makeUser();

    const created = await authed(request(app).post('/api/queries'), target.token).send(goodQuery);
    const queryId = created.body.query.id;

    // Admin bans the reporter.
    const ban = await authed(
      request(app).post(`/api/admin/users/${reporter.user.id}/ban`),
      admin.token,
    ).send({ reason: 'spam' });
    expect(ban.status).toBe(200);

    // The banned reporter is blocked from reporting.
    const report = await authed(
      request(app).post(`/api/queries/${queryId}/report`),
      reporter.token,
    ).send({ reason: 'I do not like this' });
    expect(report.status).toBe(403);
  });
});
