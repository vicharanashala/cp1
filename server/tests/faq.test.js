import request from 'supertest';
import { createApp } from '../app.js';
import { setupTestDB, teardownTestDB, clearDB } from './helpers.js';
import { User } from '../models/User.js';
import { FaqEntry } from '../models/FaqEntry.js';
import { ai } from '../config/ai.js';

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

async function seedFaq(category, question, answer) {
  const embedding = await ai.embed(`${question}\n\n${answer}`);
  return FaqEntry.create({ category, question, answer, source: 'admin', embedding });
}

// Build a resolved community question (asker + answerer + admin finalize).
async function resolvedQuery() {
  const asker = await makeUser();
  const answerer = await makeUser();
  const admin = await makeAdmin();
  const created = await authed(request(app).post('/api/queries'), asker.token).send({
    title: 'How do I configure the database connection?',
    body: 'My Express server cannot connect to MongoDB in production and keeps timing out.',
  });
  const query = created.body.query;
  const posted = await authed(
    request(app).post(`/api/queries/${query.id}/answers`),
    answerer.token,
  ).send({ body: 'Increase serverSelectionTimeoutMS and reuse a single pooled connection.' });
  await authed(request(app).post(`/api/queries/${query.id}/solution`), asker.token).send({
    answerId: posted.body.answer.id,
  });
  await authed(request(app).post('/api/jobs/finalize-solutions/run'), admin.token).send();
  return { query, admin };
}

describe('FAQ', () => {
  test('lists entries grouped by category', async () => {
    await seedFaq('Account', 'How do I reset my password?', 'Use the forgot password link.');
    await seedFaq('Reputation', 'How do I earn points?', 'Get likes and accepted answers.');

    const res = await request(app).get('/api/faq');
    expect(res.status).toBe(200);
    expect(res.body.groups).toHaveLength(2);
    expect(res.body.groups[0].items[0].embedding).toBeUndefined();
  });

  test('search surfaces the most relevant entry', async () => {
    await seedFaq('Account', 'How do I reset my password?', 'Use the forgot password link on login.');
    await seedFaq('Billing', 'How do I update my card?', 'Open billing settings.');

    const res = await request(app).get('/api/faq/search').query({ q: 'reset password' });
    expect(res.status).toBe(200);
    expect(res.body.results[0].question).toMatch(/reset my password/i);
  });
});

describe('RAG chatbot', () => {
  test('Tier 1: answers from the FAQ with a citation and persists the session', async () => {
    await seedFaq('Account', 'How do I reset my password?', 'Use the forgot password link; the email link lasts one hour.');

    const res = await request(app)
      .post('/api/chatbot/ask')
      .send({ message: 'How do I reset my password?' });
    expect(res.status).toBe(200);
    expect(res.body.source_tier).toBe('faq');
    expect(res.body.citations[0].kind).toBe('faq');
    expect(res.body.session_token).toBeTruthy();

    const followup = await request(app)
      .post('/api/chatbot/ask')
      .send({ message: 'And how long is the link valid?', session_token: res.body.session_token });
    expect(followup.body.session_token).toBe(res.body.session_token);

    const session = await request(app).get(`/api/chatbot/session/${res.body.session_token}`);
    expect(session.body.messages).toHaveLength(4); // 2 user + 2 assistant
  });

  test('Tier 2: falls through to a resolved community answer', async () => {
    const { query } = await resolvedQuery(); // no FAQ seeded → Tier 1 misses

    const res = await request(app)
      .post('/api/chatbot/ask')
      .send({ message: 'How do I configure the database connection?' });
    expect(res.body.source_tier).toBe('community');
    expect(res.body.citations[0].kind).toBe('query');
    expect(String(res.body.citations[0].ref_id)).toBe(query.id);
  });

  test('graceful fallback when nothing matches', async () => {
    const res = await request(app)
      .post('/api/chatbot/ask')
      .send({ message: 'What is the airspeed velocity of an unladen swallow?' });
    expect(res.body.source_tier).toBe('fallback');
    expect(res.body.citations).toHaveLength(0);
  });
});

describe('FAQ promotion', () => {
  test('admin promotes a resolved question into the FAQ', async () => {
    const { query, admin } = await resolvedQuery();

    const res = await authed(request(app).post(`/api/faq/promote/${query.id}`), admin.token).send();
    expect(res.status).toBe(201);
    expect(res.body.entry.source).toBe('qa');
    expect(String(res.body.entry.source_query_id)).toBe(query.id);

    // Re-promoting the same question is rejected.
    const again = await authed(request(app).post(`/api/faq/promote/${query.id}`), admin.token).send();
    expect(again.status).toBe(409);
  });

  test('cannot promote an unresolved question, and non-admins are blocked', async () => {
    const asker = await makeUser();
    const created = await authed(request(app).post('/api/queries'), asker.token).send({
      title: 'An open question with no accepted answer yet',
      body: 'This question has not been resolved so it should not be promotable.',
    });
    const admin = await makeAdmin();

    const unresolved = await authed(
      request(app).post(`/api/faq/promote/${created.body.query.id}`),
      admin.token,
    ).send();
    expect(unresolved.status).toBe(400);

    const forbidden = await authed(
      request(app).post(`/api/faq/promote/${created.body.query.id}`),
      asker.token,
    ).send();
    expect(forbidden.status).toBe(403);
  });
});
