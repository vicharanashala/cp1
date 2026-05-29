// Seed script skeleton. Milestones add demo data here; the structure and the
// offline-embedding hook are in place now so later content is embedded once,
// offline (zero live AI calls on browse — PLANNING §8).
import { connectDB, disconnectDB } from '../config/db.js';
import { ai } from '../config/ai.js';
import { User } from '../models/User.js';
import { FaqEntry } from '../models/FaqEntry.js';
import { hashPassword } from '../utils/password.js';
import { ROLES, FAQ_SOURCE } from '../config/constants.js';

// Embed a batch of {text} items offline and attach .embedding. Used by later
// seeds for queries / faq_entries so search & RAG work with no live calls.
export async function embedSeedItems(items) {
  const vectors = await ai.embedBatch(items.map((i) => i.text));
  return items.map((item, idx) => ({ ...item, embedding: vectors[idx] }));
}

async function seedUsers() {
  const seedData = [
    { name: 'Admin', email: 'admin@example.com', password: 'admin12345', role: ROLES.ADMIN },
    { name: 'Demo User', email: 'demo@example.com', password: 'demo12345', role: ROLES.USER },
  ];

  for (const u of seedData) {
    const exists = await User.findOne({ email: u.email });
    if (exists) continue;
    await User.create({
      name: u.name,
      email: u.email,
      role: u.role,
      password_hash: await hashPassword(u.password),
    });
    // eslint-disable-next-line no-console
    console.log(`[seed] created ${u.role}: ${u.email}`);
  }
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
    // eslint-disable-next-line no-console
    console.log(`[seed] created FAQ: ${f.question}`);
  }
}

async function run() {
  await connectDB();
  await seedUsers();
  await seedFaqs();
  // Later milestones: seed demo queries, answers, notifications, etc.
  // eslint-disable-next-line no-console
  console.log('[seed] done');
  await disconnectDB();
}

// Run only when invoked directly (not when imported by other seeds/tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[seed] failed', err);
    process.exit(1);
  });
}

export { run };
