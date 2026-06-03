import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

// Live countdown banner shown while the logged-in user is banned.
function formatRemaining(ms) {
  if (ms <= 0) return 'expiring…';
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${m}m ${s}s`;
}

export default function BanBanner() {
  const { user } = useAuth();
  const [now, setNow] = useState(Date.now());

  const expires = user?.ban_expires_at ? new Date(user.ban_expires_at).getTime() : null;
  const banned = user?.is_banned;

  useEffect(() => {
    if (!banned || !expires) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [banned, expires]);

  if (!banned) return null;

  return (
    <div className="ban-banner">
      Your account is banned{' '}
      {expires ? (
        <>
          - lifting in <strong>{formatRemaining(expires - now)}</strong>
        </>
      ) : (
        <>permanently</>
      )}
      .{user.ban_reason ? ` ${user.ban_reason}` : ''} You can browse, but not post.
    </div>
  );
}
