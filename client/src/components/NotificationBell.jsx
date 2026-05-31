import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { listNotifications, getUnreadCount, markRead, markAllRead } from '../api/notifications.js';

const POLL_MS = 30_000;

export default function NotificationBell() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);

  const refreshCount = useCallback(async () => {
    try {
      setCount(await getUnreadCount());
    } catch {
      /* ignore transient errors */
    }
  }, []);

  // Poll the unread count while logged in.
  useEffect(() => {
    if (!user) return undefined;
    refreshCount();
    const t = setInterval(refreshCount, POLL_MS);
    return () => clearInterval(t);
  }, [user, refreshCount]);

  const togglePanel = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      try {
        setItems(await listNotifications());
      } catch {
        setItems([]);
      }
    }
  };

  const onMarkAll = async () => {
    await markAllRead();
    setItems((list) => list.map((n) => ({ ...n, is_read: true })));
    setCount(0);
  };

  const onClickItem = async (n) => {
    if (!n.is_read) {
      await markRead(n._id);
      setCount((c) => Math.max(0, c - 1));
    }
    setOpen(false);
  };

  if (!user) return null;

  return (
    <div className="bell-wrap">
      <button className="bell-btn" onClick={togglePanel} aria-label="Notifications">
        <span className="material-symbols-outlined">notifications</span>
        {count > 0 && <span className="bell-badge">{count > 9 ? '9+' : count}</span>}
      </button>

      {open && (
        <div className="bell-panel">
          <div className="bell-head">
            <strong>Notifications</strong>
            {items.some((n) => !n.is_read) && (
              <button className="btn-link" onClick={onMarkAll}>
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="muted bell-empty">No notifications yet.</p>
          ) : (
            <ul className="bell-list">
              {items.map((n) => {
                const body = (
                  <>
                    <span className="n-title">{n.title}</span>
                    {n.message && <span className="n-msg">{n.message}</span>}
                  </>
                );
                return (
                  <li key={n._id} className={n.is_read ? 'read' : 'unread'}>
                    {n.link ? (
                      <Link to={n.link} onClick={() => onClickItem(n)}>
                        {body}
                      </Link>
                    ) : (
                      <button className="n-plain" onClick={() => onClickItem(n)}>
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
