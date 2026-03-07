import { useState, useEffect } from 'react';
import { fetchDevices, removeDevice } from '../api';

export default function DeviceList() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [removing, setRemoving] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDevices();
      setDevices(data.devices || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleRemove(id, hostname) {
    if (!confirm(`Remove device "${hostname}" from the tailnet?`)) return;
    setRemoving(id);
    try {
      await removeDevice(id);
      setDevices((d) => d.filter((x) => x.id !== id));
    } catch (err) {
      alert(`Failed: ${err.message}`);
    } finally {
      setRemoving(null);
    }
  }

  if (loading) return <Status>Loading devices...</Status>;
  if (error) return <Status error>Error: {error}</Status>;

  const online = devices.filter((d) => d.online).length;

  return (
    <div>
      <SectionHeader
        title={`Devices (${devices.length})`}
        subtitle={`${online} online`}
        onRefresh={load}
      />

      {devices.length === 0 && <Status>No devices found in tailnet.</Status>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {devices.map((d) => (
          <div key={d.id} style={S.card}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: d.online ? '#4aff4a' : '#444',
                flexShrink: 0,
                marginTop: 2,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#e0e0e0' }}>{d.hostname}</div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                {d.user} &mdash; <span style={{ color: '#555' }}>ID: {d.id}</span>
              </div>
            </div>
            <span
              style={{
                fontSize: 11,
                color: d.online ? '#4aff4a' : '#555',
                marginRight: 8,
                flexShrink: 0,
              }}
            >
              {d.online ? 'Online' : 'Offline'}
            </span>
            <button
              onClick={() => handleRemove(d.id, d.hostname)}
              disabled={removing === d.id}
              style={{ ...btn, borderColor: '#7a2020', color: '#ff6b6b' }}
            >
              {removing === d.id ? 'Removing...' : 'Remove'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle, onRefresh }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#e0e0e0' }}>{title}</h2>
      {subtitle && <span style={{ fontSize: 12, color: '#666' }}>{subtitle}</span>}
      <div style={{ flex: 1 }} />
      <button onClick={onRefresh} style={btn}>Refresh</button>
    </div>
  );
}

function Status({ children, error }) {
  return (
    <div style={{ color: error ? '#ff4a4a' : '#666', fontSize: 13, padding: '16px 0' }}>
      {children}
    </div>
  );
}

const S = {
  card: {
    background: '#252525',
    border: '1px solid #2e2e2e',
    borderRadius: 6,
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
};

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
