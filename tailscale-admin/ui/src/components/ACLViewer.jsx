import { useState, useEffect } from 'react';
import { fetchACL } from '../api';

export default function ACLViewer() {
  const [acl, setAcl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchACL();
      setAcl(data.policy);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div style={{ color: '#666', fontSize: 13, padding: '16px 0' }}>Loading ACL...</div>;
  if (error) return <div style={{ color: '#ff4a4a', fontSize: 13, padding: '16px 0' }}>Error: {error}</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#e0e0e0' }}>ACL Policy</h2>
        <span style={{ marginLeft: 8, fontSize: 11, color: '#555' }}>read-only</span>
        <div style={{ flex: 1 }} />
        <button onClick={load} style={btn}>Refresh</button>
      </div>
      <pre
        style={{
          background: '#252525',
          border: '1px solid #2e2e2e',
          borderRadius: 6,
          padding: 20,
          color: '#7ec8a0',
          fontSize: 12,
          lineHeight: 1.6,
          overflow: 'auto',
          maxHeight: '70vh',
        }}
      >
        {JSON.stringify(acl, null, 2)}
      </pre>
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
};
