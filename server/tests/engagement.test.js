// Milestone 13 — engagement features: answer counts, question voting,
// bookmarks, and answer up/down voting (with reputation rules preserved).
import request from 'supertest';
import { createApp } from '../app.js';
import { setupTestDB, teardownTestDB, clearDB } from './helpers.js';
import { User } from '../models/User.js';
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

async function makeUser(name = 'User') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email: `u${Math.random().toString(36).slice(2)}@example.com`, password: 'supersecret1' });
  return { token: res.body.accessToken, user: res.body.user };
}

const authed = (req, token) => req.set('Authorization', `Bearer ${token}`);

const goodQuery = {
  title: 'How do I configure the database connection pool?',
  body: 'My Express server keeps dropping its MongoDB connection under load. What pool settings help?',
};

async function createQuery(token) {
  const res = await authed(request(app).post('/api/queries'), token).send(goodQuery);
  return res.body.query;
}

async function postAnswer(token, queryId) {
  const res = await authed(request(app).post(`/api/queries/${queryId}/answers`), token).send({
    body: 'Use a bounded connection pool and a sensible serverSelectionTimeoutMS.',
  });
  return res.body.answer;
}

describe('answer counts', () => {
  test('list and detail expose an answer_count', async () => {
    const asker = await makeUser('Asker');
    const answerer = await makeUser('Answerer');
    const query = await createQuery(asker.token);
    await postAnswer(answerer.token, query.id);

    const list = await request(app).get('/api/queries');
    const found = list.body.items.find((q) => q.id === query.id);
    expect(found.answer_count).toBe(1);

    const detail = await request(app).get(`/api/queries/${query.id}`);
    expect(detail.body.query.answer_count).toBe(1);
  });
});

describe('question voting', () => {
  test('up/down/clear updates the score; re-voting toggles off; self-vote is blocked', async () => {
    const asker = await makeUser('Asker');
    const voter = await makeUser('Voter');
    const query = await createQuery(asker.token);

    const up = await authed(request(app).post(`/api/queries/${query.id}/vote`), voter.token).send({ value: 1 });
    expect(up.body).toEqual({ vote_score: 1, my_vote: 1 });

    // Viewer sees their vote reflected on the detail.
    const seen = await authed(request(app).get(`/api/queries/${query.id}`), voter.token);
    expect(seen.body.query.vote_score).toBe(1);
    expect(seen.body.query.my_vote).toBe(1);

    // Re-voting the same way clears it.
    const again = await authed(request(app).post(`/api/queries/${query.id}/vote`), voter.token).send({ value: 1 });
    expect(again.body).toEqual({ vote_score: 0, my_vote: 0 });

    // Downvote.
    const down = await authed(request(app).post(`/api/queries/${query.id}/vote`), voter.token).send({ value: -1 });
    expect(down.body).toEqual({ vote_score: -1, my_vote: -1 });

    // The author cannot vote on their own question.
    const self = await authed(request(app).post(`/api/queries/${query.id}/vote`), asker.token).send({ value: 1 });
    expect(self.status).toBe(400);
  });
});

describe('bookmarks', () => {
  test('toggle save and list the saved questions', async () => {
    const asker = await makeUser('Asker');
    const reader = await makeUser('Reader');
    const query = await createQuery(asker.token);

    const saved = await authed(request(app).post(`/api/queries/${query.id}/save`), reader.token).send();
    expect(saved.body).toEqual({ saved: true });

    const list = await authed(request(app).get('/api/queries/bookmarks'), reader.token);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].id).toBe(query.id);

    const unsaved = await authed(request(app).post(`/api/queries/${query.id}/save`), reader.token).send();
    expect(unsaved.body).toEqual({ saved: false });

    const empty = await authed(request(app).get('/api/queries/bookmarks'), reader.token);
    expect(empty.body.items).toHaveLength(0);
  });
});

describe('answer voting', () => {
  test('downvotes lower the score but not like_count or the author reputation', async () => {
    const asker = await makeUser('Asker');
    const answerer = await makeUser('Answerer');
    const u1 = await makeUser('Voter1');
    const u2 = await makeUser('Voter2');
    const query = await createQuery(asker.token);
    const answer = await postAnswer(answerer.token, query.id);

    // Upvote awards the author points (like the legacy /like).
    const up = await authed(request(app).post(`/api/answers/${answer.id}/vote`), u1.token).send({ value: 1 });
    expect(up.body).toMatchObject({ value: 1, like_count: 1, score: 1 });
    let author = await User.findById(answerer.user.id);
    expect(author.points).toBe(POINTS.ANSWER_LIKED);

    // u1 switches to a downvote: upvote removed (points back to 0, like_count 0),
    // downvote recorded (score -1).
    const switched = await authed(request(app).post(`/api/answers/${answer.id}/vote`), u1.token).send({ value: -1 });
    expect(switched.body).toMatchObject({ value: -1, like_count: 0, score: -1 });
    author = await User.findById(answerer.user.id);
    expect(author.points).toBe(0);

    // A second downvote from u2 lowers the score further, still no reputation hit.
    const down2 = await authed(request(app).post(`/api/answers/${answer.id}/vote`), u2.token).send({ value: -1 });
    expect(down2.body).toMatchObject({ value: -1, like_count: 0, score: -2 });
    author = await User.findById(answerer.user.id);
    expect(author.points).toBe(0);

    // The author cannot vote on their own answer.
    const self = await authed(request(app).post(`/api/answers/${answer.id}/vote`), answerer.token).send({ value: 1 });
    expect(self.status).toBe(400);
  });
});
