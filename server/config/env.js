// Centralized environment loading. Read process.env in exactly one place so
// the rest of the app imports typed, defaulted config instead of touching
// process.env directly.
import dotenv from 'dotenv';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

// Resolve a secret. In production the env var MUST be set to a non-default
// value, otherwise we fail fast — a public repo's well-known dev fallback must
// never silently secure a real deployment (it would allow token forgery).
const secret = (key, devFallback) => {
  const value = process.env[key];
  if (isProd && (!value || value === devFallback)) {
    throw new Error(
      `${key} must be set to a strong, unique value in production (refusing to start with the dev default).`,
    );
  }
  return value || devFallback;
};

export const config = Object.freeze({
  env: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  port: Number(process.env.PORT ?? 5000),

  mongoUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/faq_platform',

  jwt: {
    accessSecret: secret('JWT_ACCESS_SECRET', 'dev-access-secret'),
    refreshSecret: secret('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },

  ai: {
    // Tests must stay deterministic and offline: ignore any real key under
    // NODE_ENV=test so a local `.env` can't push the suite into live mode
    // (non-deterministic embeddings, live quota, network flakiness).
    apiKey: process.env.NODE_ENV === 'test' ? '' : (process.env.AI_API_KEY ?? ''),
    chatModel: process.env.AI_CHAT_MODEL ?? 'gemini-2.5-flash',
    cheapModel: process.env.AI_CHEAP_MODEL ?? 'gemini-2.5-flash-lite',
    embedModel: process.env.AI_EMBED_MODEL ?? 'gemini-embedding-001',
    embedDims: Number(process.env.AI_EMBED_DIMS ?? 768),
    // When no key is set we run in mock mode: deterministic, offline, free.
    get mockMode() {
      return !this.apiKey;
    },
  },

  uploads: {
    dir: process.env.UPLOAD_DIR ?? 'uploads',
    maxMb: Number(process.env.MAX_UPLOAD_MB ?? 5),
  },

  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',

  // Trust a reverse proxy / tunnel in front of us (Cloudflare, nginx, the Vite
  // dev proxy) so req.ip and express-rate-limit read the real client from
  // X-Forwarded-For instead of throwing on it. A number = hops to trust; 'true'
  // trusts all; unset = off (direct connections only).
  trustProxy: (() => {
    const v = process.env.TRUST_PROXY;
    if (!v) return false;
    const n = Number(v);
    return Number.isNaN(n) ? v === 'true' : n;
  })(),

  // Escape hatch to disable rate limiting — e.g. a shared-IP demo behind a tunnel
  // where every visitor would otherwise collapse into a single bucket.
  rateLimitDisabled: process.env.DISABLE_RATE_LIMIT === 'true',
});
