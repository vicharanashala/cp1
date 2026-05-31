// Demo seed. Populates a complete, self-consistent dataset with OFFLINE-embedded
// content so search / duplicate detection / the RAG chatbot all work on browse
// with zero live AI calls (PLANNING §8). Idempotent: re-running skips existing
// records. Run with `npm run seed`.
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { connectDB, disconnectDB } from '../config/db.js';
import { ai } from '../config/ai.js';
import { User } from '../models/User.js';
import { FaqEntry } from '../models/FaqEntry.js';
import { Query } from '../models/Query.js';
import { Answer } from '../models/Answer.js';
import { Like } from '../models/Like.js';
import { hashPassword } from '../utils/password.js';
import { applyBadges } from '../services/badgeService.js';
import { promoteQueryToFaq } from '../services/faqService.js';
import { ROLES, FAQ_SOURCE, QUERY_STATUS, POINTS } from '../config/constants.js';

const log = (msg) => {
  // eslint-disable-next-line no-console
  console.log(`[seed] ${msg}`);
};

const embeddingText = (title, body) => `${title}\n\n${body}`.trim();
const hashText = (text) => crypto.createHash('sha256').update(text).digest('hex');

// Embed a batch of {text} items offline and attach .embedding. Available for
// callers that want to pre-embed many docs in one pass.
export async function embedSeedItems(items) {
  const vectors = await ai.embedBatch(items.map((i) => i.text));
  return items.map((item, idx) => ({ ...item, embedding: vectors[idx] }));
}

const USERS = [
  { name: 'Admin', email: 'admin@example.com', password: 'admin12345', role: ROLES.ADMIN },
  { name: 'Demo User', email: 'demo@example.com', password: 'demo12345', role: ROLES.USER },
  { name: 'Alex Rivera', email: 'alex@example.com', password: 'alex12345', role: ROLES.USER },
  { name: 'Sam Chen', email: 'sam@example.com', password: 'sam12345', role: ROLES.USER },
];

async function seedUsers() {
  const byEmail = {};
  for (const u of USERS) {
    let user = await User.findOne({ email: u.email });
    if (!user) {
      user = await User.create({
        name: u.name,
        email: u.email,
        role: u.role,
        password_hash: await hashPassword(u.password),
      });
      log(`created ${u.role}: ${u.email}`);
    }
    byEmail[u.email] = user;
  }
  return byEmail;
}

async function seedFaqs() {
  const seedData = [
    {
      category: 'Account',
      question: 'How do I reset my password?',
      answer: 'Use the "Forgot password" link on the login page. You will receive an email with a reset link valid for one hour.',
    },
    {
      category: 'Account',
      question: 'How do I change my email address?',
      answer: 'Open your profile settings, edit the email field, and confirm the change via the verification email we send.',
    },
    {
      category: 'Getting started',
      question: 'How do I ask a good question?',
      answer: 'Give a clear title, describe what you tried, add relevant tags, and attach a screenshot if it helps. The quality gates will warn you about duplicates.',
    },
    {
      category: 'Reputation',
      question: 'How do I earn points and badges?',
      answer: 'You earn points when your answers are liked or accepted as solutions. Reaching 50, 150, 500 and 1000 points unlocks the Helper, Contributor, Expert and Legend badges.',
    },
  ];

  for (const f of seedData) {
    const exists = await FaqEntry.findOne({ question: f.question, is_deleted: false });
    if (exists) continue;
    const embedding = await ai.embed(`${f.question}\n\n${f.answer}`);
    await FaqEntry.create({ ...f, source: FAQ_SOURCE.ADMIN, embedding });
    log(`created FAQ: ${f.question}`);
  }
}

// Create a query with its offline embedding + hash, mirroring queryService.
async function makeQuery({ author, title, body, category, tags = [] }) {
  const text = embeddingText(title, body);
  return Query.create({
    title,
    body,
    author_id: author._id,
    category,
    tags,
    embedding: await ai.embed(text),
    embedding_hash: hashText(text),
  });
}

async function award(user, delta) {
  user.points = (user.points ?? 0) + delta;
  applyBadges(user);
  await user.save();
}

async function seedContent(users) {
  if ((await Query.countDocuments({})) > 0) {
    log('queries already present — skipping demo content');
    return;
  }

  const { 'demo@example.com': demo, 'alex@example.com': alex, 'sam@example.com': sam } = users;

  // 1) A thread we resolve and promote into the FAQ (the demo centerpiece).
  const indexing = await makeQuery({
    author: demo,
    title: 'How do I make MongoDB queries faster with indexes?',
    body: 'My findOne lookups on the users collection are slow as the collection grows. How should I add indexes, and how do I confirm they are being used?',
    category: 'backend',
    tags: ['mongodb', 'performance'],
  });

  const bestAnswer = await Answer.create({
    query_id: indexing._id,
    author_id: alex._id,
    body: 'Create an index on the field you filter by, e.g. `db.users.createIndex({ email: 1 })`. Confirm it is used with `db.users.find({ email }).explain("executionStats")` — look for IXSCAN instead of COLLSCAN. Use compound indexes when you filter on multiple fields together.',
    like_count: 2,
    is_accepted: true,
  });
  const okAnswer = await Answer.create({
    query_id: indexing._id,
    author_id: sam._id,
    body: 'Also make sure you are not creating the index on every request — define it once at startup or in a migration.',
    like_count: 1,
  });

  await Like.create([
    { answer_id: bestAnswer._id, user_id: demo._id },
    { answer_id: bestAnswer._id, user_id: sam._id },
    { answer_id: okAnswer._id, user_id: demo._id },
  ]);

  indexing.status = QUERY_STATUS.RESOLVED;
  indexing.accepted_answer_id = bestAnswer._id;
  indexing.first_answered_at = new Date();
  await indexing.save();

  // Reputation: accepted-answer + like points to Alex, like point to Sam,
  // resolution points to the asker.
  await award(alex, POINTS.ANSWER_ACCEPTED + 2 * POINTS.ANSWER_LIKED);
  await award(sam, POINTS.ANSWER_LIKED);
  await award(demo, POINTS.QUERY_RESOLVED);

  await promoteQueryToFaq(indexing._id);
  log('seeded + promoted the indexing thread');

  // 2) An answered (unresolved) thread.
  const jwt = await makeQuery({
    author: sam,
    title: 'JWT access token expires too quickly during development',
    body: 'My access token keeps expiring after 15 minutes while I am testing. What is a sensible expiry, and how should refresh tokens work?',
    category: 'auth',
    tags: ['jwt', 'auth'],
  });
  await Answer.create({
    query_id: jwt._id,
    author_id: alex._id,
    body: 'Keep the access token short-lived (15m is fine) and use a longer-lived refresh token to get new ones. Rotate the refresh token on each use and store only its hash server-side.',
    like_count: 1,
  });
  jwt.status = QUERY_STATUS.ANSWERED;
  jwt.first_answered_at = new Date();
  await jwt.save();

  // 3) A couple of open questions for the browse list.
  await makeQuery({
    author: demo,
    title: 'Vite dev server returns 404 for my /api requests',
    body: 'Calls to /api/... 404 in development. I think it is a proxy issue between Vite and Express. How do I set this up?',
    category: 'frontend',
    tags: ['vite', 'proxy'],
  });
  await makeQuery({
    author: alex,
    title: 'What is a good way to structure a React project?',
    body: 'I am starting a mid-sized React app and want a folder structure that scales. Any conventions you recommend?',
    category: 'frontend',
    tags: ['react', 'architecture'],
  });

  log('seeded demo queries');
}

async function run() {
  await connectDB();
  const users = await seedUsers();
  await seedFaqs();
  await seedContent(users);
  log('done');
  await disconnectDB();
}

// Run only when invoked directly (not when imported by other seeds/tests).
// pathToFileURL handles Windows paths correctly (file:///C:/… vs file://C:\…).
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[seed] failed', err);
    process.exit(1);
  });
}

export { run };
