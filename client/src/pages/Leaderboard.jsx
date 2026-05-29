import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLeaderboard } from '../api/answers.js';

export default function Leaderboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getLeaderboard();
        if (active) setUsers(data);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="container">
      <h1>Leaderboard</h1>
      <p className="lead">Reputation earned by answering, getting likes, and solving questions.</p>

      {loading ? (
        <p>Loading…</p>
      ) : users.length === 0 ? (
        <p className="muted">No reputation earned yet.</p>
      ) : (
        <ol className="leaderboard">
          {users.map((u) => (
            <li key={u.id}>
              <span className="rank">#{u.rank}</span>
              <Link className="name" to={`/users/${u.id}`}>
                {u.name}
              </Link>
              <span className="pts">{u.points} pts</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
