import request from 'supertest';
import { createApp } from '../app.js';
import { setupTestDB, teardownTestDB, clearDB } from './helpers.js';

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

const validUser = { name: 'Ada Lovelace', email: 'ada@example.com', password: 'supersecret1' };

async function registerUser(overrides = {}) {
  return request(app)
    .post('/api/auth/register')
    .send({ ...validUser, ...overrides });
}

describe('health', () => {
  test('GET /api/health returns ok + mock AI', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.ai).toBe('mock');
    expect(res.body.ai_keys).toBe(0); // mock mode → no keys in rotation
  });
});

describe('auth flow', () => {
  test('register returns user + tokens, hides password_hash', async () => {
    const res = await registerUser();
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('ada@example.com');
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  test('duplicate email is rejected with 409', async () => {
    await registerUser();
    const res = await registerUser();
    expect(res.status).toBe(409);
  });

  test('short password rejected with 400', async () => {
    const res = await registerUser({ password: 'short' });
    expect(res.status).toBe(400);
  });

  test('login with correct credentials succeeds', async () => {
    await registerUser();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: validUser.password });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  test('login with wrong password returns 401', async () => {
    await registerUser();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  test('GET /me requires a valid access token', async () => {
    const reg = await registerUser();
    const noAuth = await request(app).get('/api/auth/me');
    expect(noAuth.status).toBe(401);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${reg.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(validUser.email);
  });

  test('refresh rotates tokens; logout revokes the refresh token', async () => {
    const reg = await registerUser();
    const { refreshToken } = reg.body;

    const refreshed = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toBeTruthy();

    // old refresh token was rotated → revoked
    const reused = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(reused.status).toBe(401);

    // logout revokes the new one
    await request(app).post('/api/auth/logout').send({ refreshToken: refreshed.body.refreshToken });
    const afterLogout = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: refreshed.body.refreshToken });
    expect(afterLogout.status).toBe(401);
  });
});
