// ─── Swappable boundary: AI PROVIDER ─────────────────────────────────────────
// This is the ONLY module that calls the AI provider. It also houses the
// request queue + exponential backoff so the whole app shares one rate-limit
// budget. No other file should import the Gemini SDK.
//
// Mock mode: when AI_API_KEY is empty, every method returns a deterministic,
// offline result — no network, no quota, no cost. This keeps tests, CI, and
// no-key local runs fully functional and is the default for the MVP.
import { config } from './env.js';
import { EMBEDDING_DIMS } from './constants.js';
import { createKeyRing } from './keyRing.js';

// ── Deterministic offline embedding ──────────────────────────────────────────
// A cheap hashing embedding so semantic search / duplicate detection works in
// mock mode with stable, repeatable vectors. NOT semantically meaningful — it
// is a stand-in that real Gemini embeddings replace when a key is present.
function mockEmbed(text, dims = config.ai.embedDims || EMBEDDING_DIMS) {
  const vec = new Array(dims).fill(0);
  const tokens = String(text).toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (const tok of tokens) {
    let h = 0;
    for (let i = 0; i < tok.length; i++) {
      h = (h * 31 + tok.charCodeAt(i)) >>> 0;
    }
    vec[h % dims] += 1;
  }
  // L2-normalize so cosine similarity behaves.
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
  return vec.map((x) => x / norm);
}

// ── Request queue + exponential backoff ──────────────────────────────────────
// Serializes live calls and retries on HTTP 429 so a quota spike degrades
// gracefully instead of failing hard.
const MAX_RETRIES = 4;
const BASE_DELAY_MS = 500;

let queue = Promise.resolve();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isRateLimit(err) {
  const status = err?.status ?? err?.response?.status;
  return status === 429;
}

async function withBackoff(fn) {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (isRateLimit(err) && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * 2 ** attempt + Math.random() * 200;
        await sleep(delay);
        attempt += 1;
        continue;
      }
      throw err;
    }
  }
}

// Serialize live calls so the whole app shares one rate-limit budget.
function enqueue(fn) {
  const run = queue.then(fn);
  // Keep the chain alive even if a call rejects.
  queue = run.catch(() => {});
  return run;
}

// ── Live clients, one per key, picked round-robin ────────────────────────────
// Each configured key gets its own lazily-constructed client; requests rotate
// across them so live load is spread over every account instead of draining a
// single key's quota.
const keyRing = createKeyRing(config.ai.apiKeys);
const clients = new Map();

async function clientForKey(key) {
  let client = clients.get(key);
  if (!client) {
    const { GoogleGenAI } = await import('@google/genai');
    client = new GoogleGenAI({ apiKey: key });
    clients.set(key, client);
  }
  return client;
}

// Run one live API call on the next key in the rotation, retrying on 429.
async function liveCall(run) {
  const client = await clientForKey(keyRing.next());
  return withBackoff(() => run(client));
}

// ── Public API ───────────────────────────────────────────────────────────────

export const ai = {
  get mockMode() {
    return config.ai.mockMode;
  },

  /**
   * Embed a single string → number[] of length embedDims.
   */
  async embed(text) {
    if (this.mockMode) return mockEmbed(text);
    return enqueue(() =>
      liveCall(async (client) => {
        const res = await client.models.embedContent({
          model: config.ai.embedModel,
          contents: text,
          config: { outputDimensionality: config.ai.embedDims },
        });
        return res.embeddings?.[0]?.values ?? mockEmbed(text);
      }),
    );
  },

  /**
   * Embed many strings → number[][]. Falls back to per-item embed.
   */
  async embedBatch(texts) {
    return Promise.all(texts.map((t) => this.embed(t)));
  },

  /**
   * Cheap structured check (gibberish, auto-correct) on flash-lite.
   * Returns parsed JSON. In mock mode returns a permissive default.
   * @param {string} prompt
   * @param {object} [mockResult] deterministic stand-in for mock mode.
   */
  async cheapJson(prompt, mockResult = {}) {
    if (this.mockMode) return mockResult;
    return enqueue(() =>
      liveCall(async (client) => {
        const res = await client.models.generateContent({
          model: config.ai.cheapModel,
          contents: prompt,
          config: { responseMimeType: 'application/json' },
        });
        try {
          return JSON.parse(res.text ?? '{}');
        } catch {
          return mockResult;
        }
      }),
    );
  },

  /**
   * Compose a chat answer (RAG) on flash. In mock mode returns a canned
   * fallback so the chatbot stays functional offline.
   * @param {string} prompt
   * @param {string} [mockText]
   */
  async chat(prompt, mockText = '') {
    if (this.mockMode) {
      return (
        mockText ||
        "I'm running in offline mode right now, so I can't compose a live answer. Please browse the FAQ or ask the community."
      );
    }
    return enqueue(() =>
      liveCall(async (client) => {
        const res = await client.models.generateContent({
          model: config.ai.chatModel,
          contents: prompt,
        });
        return res.text ?? '';
      }),
    );
  },
};

export default ai;
