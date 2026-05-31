import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMetrics, getHealth, getAudit, listUsers } from '../../api/admin.js';
import { relativeTime } from '../../lib/time.js';

function KpiCard({ icon, label, value, sub, tone }) {
  return (
    <div className={`kpi-card ${tone ? `tone-${tone}` : ''}`}>
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <strong className="kpi-value">{value}</strong>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  );
}

export default function AdminOverview() {
  const [metrics, setMetrics] = useState(null);
  const [health, setHealth] = useState(null);
  const [audit, setAudit] = useState([]);
  const [approvals, setApprovals] = useState(0);

  useEffect(() => {
    getMetrics().then(setMetrics).catch(() => setMetrics(null));
    getHealth().then(setHealth).catch(() => setHealth(null));
    getAudit({ limit: 6 })
      .then((d) => setAudit(d.items ?? []))
      .catch(() => setAudit([]));
    // Approximate pending-approval count from the first page of users.
    listUsers({ limit: 50 })
      .then((d) => setApprovals((d.items ?? []).filter((u) => u.requires_approval).length))
      .catch(() => setApprovals(0));
  }, []);

  if (!metrics) return <p>Loading metrics…</p>;

  const total = metrics.queries || 0;
  const resolutionRate = total ? Math.round((metrics.resolved / total) * 1000) / 10 : 0;
  const modQueue = metrics.pending_moderation || 0;
  const modHigh = modQueue >= 10;
  const aiOk = health?.status === 'ok';

  // "Needs attention" items, each backed by real data + a deep link.
  const attention = [
    modQueue > 0 && {
      icon: 'flag',
      title: 'Flagged content review',
      sub: `${modQueue} item${modQueue === 1 ? '' : 's'} in the moderation queue`,
      to: '/admin/moderation',
      cta: 'Review',
    },
    approvals > 0 && {
      icon: 'group_add',
      title: 'Pending user approvals',
      sub: `${approvals} user${approvals === 1 ? '' : 's'} awaiting clearance`,
      to: '/admin/users',
      cta: 'Manage',
    },
    metrics.open > 0 && {
      icon: 'forum',
      title: 'Open questions',
      sub: `${metrics.open} question${metrics.open === 1 ? '' : 's'} awaiting answers`,
      to: '/queries?status=open',
      cta: 'View',
    },
  ].filter(Boolean);

  return (
    <div className="admin-overview">
      <header className="overview-head">
        <h2>System Overview</h2>
        <p className="muted">Real-time telemetry and operational metrics.</p>
      </header>

      <div className="kpi-row">
        <KpiCard icon="group" label="TOTAL USERS" value={(metrics.users || 0).toLocaleString()} sub={`${metrics.banned || 0} banned`} />
        <KpiCard icon="forum" label="OPEN QUESTIONS" value={(metrics.open || 0).toLocaleString()} sub={`${total} total`} />
        <KpiCard icon="check_circle" label="RESOLUTION RATE" value={`${resolutionRate}%`} sub={`${metrics.resolved || 0} resolved`} tone="good" />
        <KpiCard
          icon="warning"
          label="MOD QUEUE"
          value={modQueue.toLocaleString()}
          sub={modHigh ? 'High load' : 'Nominal'}
          tone={modHigh ? 'warn' : undefined}
        />
        <KpiCard
          icon="memory"
          label="AI STATUS"
          value={aiOk ? 'Operational' : 'Unknown'}
          sub={health ? `${health.ai} mode` : '—'}
          tone={aiOk ? 'good' : 'warn'}
        />
      </div>

      <div className="overview-grid">
        <section className="card">
          <div className="card-head">
            <h3>Needs Attention</h3>
          </div>
          {attention.length === 0 ? (
            <p className="muted">All clear — nothing needs attention right now. 🎉</p>
          ) : (
            <ul className="attention-list">
              {attention.map((a) => (
                <li key={a.title}>
                  <span className="material-symbols-outlined att-icon">{a.icon}</span>
                  <div className="att-text">
                    <strong>{a.title}</strong>
                    <span className="muted">{a.sub}</span>
                  </div>
                  <Link to={a.to} className="btn-secondary">
                    {a.cta}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Recent Audit Log</h3>
            <Link to="/admin/audit" className="btn-ghost">
              View all
            </Link>
          </div>
          {audit.length === 0 ? (
            <p className="muted">No audit entries yet.</p>
          ) : (
            <ul className="audit-feed">
              {audit.map((a) => (
                <li key={a._id}>
                  <span className="material-symbols-outlined">history</span>
                  <div className="audit-text">
                    <span>
                      <strong>{a.action}</strong>
                      {a.entity_type ? ` · ${a.entity_type}` : ''}
                    </span>
                    <span className="muted small">
                      {a.performed_by?.name ? `${a.performed_by.name} · ` : 'System · '}
                      {relativeTime(a.createdAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
