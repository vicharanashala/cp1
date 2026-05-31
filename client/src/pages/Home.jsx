import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { reputationStanding, badgeDefs } from '../lib/reputation.js';
import { getActivity } from '../api/users.js';
import { relativeTime } from '../lib/time.js';

function timeOfDay(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// Three primary entry points (Frozen Precision home dashboard).
const ACTIONS = [
  {
    icon: 'smart_toy',
    title: 'Ask the Assistant',
    desc: 'Get instant AI-driven answers.',
    action: { type: 'chatbot' },
  },
  {
    icon: 'menu_book',
    title: 'Browse the FAQ',
    desc: 'Curated solutions and guides.',
    action: { type: 'link', to: '/faq' },
  },
  {
    icon: 'groups',
    title: 'Ask the Community',
    desc: 'Tap into collective wisdom.',
    action: { type: 'link', to: '/ask' },
  },
];

function ActionCard({ icon, title, desc, action }) {
  const body = (
    <>
      <span className="material-symbols-outlined action-icon">{icon}</span>
      <strong>{title}</strong>
      <span className="muted">{desc}</span>
    </>
  );
  if (action.type === 'chatbot') {
    return (
      <button
        className="action-card"
        onClick={() => window.dispatchEvent(new Event('open-chatbot'))}
      >
        {body}
      </button>
    );
  }
  return (
    <Link to={action.to} className="action-card">
      {body}
    </Link>
  );
}

// Circular reputation gauge (SVG). progress is 0–100.
function ReputationRing({ points, progress }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c - (progress / 100) * c;
  return (
    <svg className="rep-ring" viewBox="0 0 128 128" width="140" height="140">
      <circle cx="64" cy="64" r={r} className="rep-track" />
      <circle
        cx="64"
        cy="64"
        r={r}
        className="rep-progress"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 64 64)"
      />
      <text x="64" y="60" className="rep-value">
        {points.toLocaleString()}
      </text>
      <text x="64" y="80" className="rep-label">
        POINTS
      </text>
    </svg>
  );
}

function ReputationPanel({ user }) {
  const points = user.points ?? 0;
  const { tier, next, ptsToNext, progressPct, isMax } = reputationStanding(points);
  const badges = badgeDefs(user.badges ?? []);

  return (
    <aside className="card rep-card">
      <h2>Your Reputation</h2>
      <ReputationRing points={points} progress={progressPct} />
      <div className="rep-tier">
        <strong>
          {tier.icon} {tier.label}
        </strong>
        {!isMax && <span className="muted">{ptsToNext} pts to {next.label}</span>}
        {isMax && <span className="muted">Top tier reached 🎉</span>}
      </div>
      <div className="rep-bar">
        <span style={{ width: `${progressPct}%` }} />
      </div>
      <div className="rep-badges">
        <span className="label-sm">RECENT BADGES</span>
        {badges.length ? (
          <div className="badge-icons">
            {badges.map((b) => (
              <span key={b.key} className="badge-chip" title={b.label}>
                {b.icon}
              </span>
            ))}
          </div>
        ) : (
          <p className="muted small">Earn your first badge at 50 points.</p>
        )}
      </div>
    </aside>
  );
}

function RecentActivity() {
  const [items, setItems] = useState(null);
  useEffect(() => {
    getActivity(8)
      .then(setItems)
      .catch(() => setItems([]));
  }, []);
  if (items === null) return null;
  return (
    <section className="card activity-card">
      <div className="card-head">
        <h2>Recent Activity</h2>
      </div>
      {items.length === 0 ? (
        <p className="muted">No activity yet — ask or answer something to get started.</p>
      ) : (
        <ul className="activity-list">
          {items.map((a, i) => (
            <li key={i}>
              <span className={`act-tag act-${a.type}`}>{a.label}</span>
              <Link to={a.link} className="act-title">
                {a.title}
              </Link>
              <span className="muted small act-when">{relativeTime(a.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Home() {
  const { user } = useAuth();
  const greeting = timeOfDay(new Date().getHours());
  const streak = user?.login_streak ?? 0;

  return (
    <div className="container">
      <header className="dash-head">
        <div>
          <h1>{user ? `${greeting}, ${user.name.split(' ')[0]}` : 'Knowledge Hub'}</h1>
          <p className="lead">
            {user
              ? 'Here is your daily knowledge snapshot.'
              : 'A self-improving knowledge base — AI chatbot, quality-gated questions, and a community forum.'}
          </p>
        </div>
        {user && streak > 1 && (
          <span className="streak-chip">
            <span className="material-symbols-outlined">local_fire_department</span>
            {streak}-day streak
          </span>
        )}
      </header>

      <div className={`dash-grid ${user ? 'with-rep' : ''}`}>
        <div className="dash-left">
          <section className="action-cards">
            {ACTIONS.map((a) => (
              <ActionCard key={a.title} {...a} />
            ))}
          </section>
          {user && <RecentActivity />}
        </div>

        {user ? (
          <ReputationPanel user={user} />
        ) : (
          <aside className="card signup-card">
            <h2>Join the community</h2>
            <p className="muted">
              Create an account to ask questions, answer others, and earn reputation.
            </p>
            <Link to="/register" className="btn-primary">
              Sign up
            </Link>
            <Link to="/queries" className="btn-ghost">
              Browse questions →
            </Link>
          </aside>
        )}
      </div>
    </div>
  );
}
