import { useState, useEffect } from 'react';
import { fetchGroups, addUserToGroup, removeUserFromGroup, revokeUser } from '../api';

export default function UserGroups() {
  const [groups, setGroups] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addInputs, setAddInputs] = useState({});
  const [busy, setBusy] = useState(null); // tracks which operation is in-flight

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGroups();
      setGroups(data.groups || {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(groupKey) {
    const user = (addInputs[groupKey] || '').trim();
    if (!user) return;
    // groupKey is e.g. "group:admins", API expects just "admins"
    const groupName = groupKey.replace(/^group:/, '');
    setBusy(`add-${groupKey}`);
    try {
      await addUserToGroup(groupName, user);
      setAddInputs((i) => ({ ...i, [groupKey]: '' }));
      await load();
    } catch (err) {
      alert(`Failed to add user: ${err.message}`);
    } finally {
      setBusy(null);
    }
  }

  async function handleRemoveFromGroup(groupKey, user) {
    const groupName = groupKey.replace(/^group:/, '');
    setBusy(`remove-${groupKey}-${user}`);
    try {
      await removeUserFromGroup(groupName, user);
      await load();
    } catch (err) {
      alert(`Failed to remove user: ${err.message}`);
    } finally {
      setBusy(null);
    }
  }

  async function handleRevoke(user) {
    if (
      !confirm(
        `Fully revoke "${user}"?\n\nThis will:\n• Remove them from all ACL groups\n• Delete all their tailnet devices\n\nThis cannot be undone.`
      )
    )
      return;
    setBusy(`revoke-${user}`);
    try {
      await revokeUser(user);
      await load();
    } catch (err) {
      alert(`Failed to revoke user: ${err.message}`);
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div style={{ color: '#666', fontSize: 13, padding: '16px 0' }}>Loading groups...</div>;
  if (error) return <div style={{ color: '#ff4a4a', fontSize: 13, padding: '16px 0' }}>Error: {error}</div>;

  const groupEntries = Object.entries(groups);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#e0e0e0' }}>
          ACL Groups ({groupEntries.length})
        </h2>
        <div style={{ flex: 1 }} />
        <button onClick={load} style={btn}>Refresh</button>
      </div>

      {groupEntries.length === 0 && (
        <div style={{ color: '#666', fontSize: 13 }}>
          No groups defined in the ACL policy.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {groupEntries.map(([groupKey, members]) => (
          <div
            key={groupKey}
            style={{
              background: '#252525',
              border: '1px solid #2e2e2e',
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            {/* Group header */}
            <div
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid #2e2e2e',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ fontWeight: 700, color: '#5bbad5', fontSize: 13 }}>{groupKey}</span>
              <span style={{ fontSize: 11, color: '#555' }}>{members.length} member{members.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Members */}
            {members.length === 0 && (
              <div style={{ padding: '10px 16px', fontSize: 12, color: '#555' }}>No members</div>
            )}
            {members.map((user) => (
              <div
                key={user}
                style={{
                  padding: '8px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderBottom: '1px solid #202020',
                }}
              >
                <span style={{ flex: 1, fontSize: 13, color: '#c0c0c0' }}>{user}</span>
                <button
                  onClick={() => handleRemoveFromGroup(groupKey, user)}
                  disabled={!!busy}
                  style={btn}
                >
                  Remove from group
                </button>
                <button
                  onClick={() => handleRevoke(user)}
                  disabled={!!busy}
                  style={{ ...btn, borderColor: '#7a2020', color: '#ff6b6b' }}
                >
                  {busy === `revoke-${user}` ? 'Revoking...' : 'Revoke user'}
                </button>
              </div>
            ))}

            {/* Add user row */}
            <div style={{ padding: '10px 16px', display: 'flex', gap: 8, background: '#1e1e1e' }}>
              <input
                value={addInputs[groupKey] || ''}
                onChange={(e) => setAddInputs((i) => ({ ...i, [groupKey]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd(groupKey)}
                placeholder="user@example.com"
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  background: '#252525',
                  border: '1px solid #3d3d3d',
                  borderRadius: 4,
                  color: '#e0e0e0',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
              <button
                onClick={() => handleAdd(groupKey)}
                disabled={!addInputs[groupKey]?.trim() || !!busy}
                style={{ ...btn, borderColor: '#2a4a6b', color: '#4a9eff' }}
              >
                {busy === `add-${groupKey}` ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const btn = {
  padding: '5px 11px',
  background: 'transparent',
  border: '1px solid #3d3d3d',
  borderRadius: 4,
  color: '#888',
  cursor: 'pointer',
  fontSize: 11,
  fontFamily: 'inherit',
  flexShrink: 0,
};
