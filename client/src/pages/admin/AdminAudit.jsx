import { useEffect, useState } from 'react';
import { getAudit } from '../../api/admin.js';

export default function AdminAudit() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    getAudit().then((d) => setItems(d.items)).catch(() => setItems([]));
  }, []);

  return (
    <div>
      {items.length === 0 ? (
        <p className="muted">No audit entries yet.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Action</th>
              <th>Entity</th>
              <th>By</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a._id}>
                <td className="small nowrap">{new Date(a.createdAt).toLocaleString()}</td>
                <td><code>{a.action}</code></td>
                <td className="small">
                  {a.entity_type}
                  {a.entity_id ? ` (${String(a.entity_id).slice(-6)})` : ''}
                </td>
                <td className="small">{a.performed_by?.name ?? 'system'}</td>
                <td className="small">
                  {a.details && Object.keys(a.details).length > 0 ? JSON.stringify(a.details) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
