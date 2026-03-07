import { useState, useEffect } from 'react';
import { fetchMe } from './api';
import DeviceList from './components/DeviceList';
import UserGroups from './components/UserGroups';
import ACLViewer from './components/ACLViewer';

const TABS = ['devices', 'groups', 'acl'];

export default function App() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('devices');

  useEffect(() => {
    fetchMe()
      .then(setMe)
      .catch(() => setMe({ user: 'unknown', isAdmin: false, tailnetServiceAvailable: false }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={S.center}>
        <span style={{ color: '#888', fontSize: 13 }}>Loading...</span>
      </div>
    );
  }

  if (!me?.tailnetServiceAvailable) {
    return (
      <div style={S.center}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#ff4a4a', marginBottom: 12 }}>
          Tailscale Admin Service Offline
        </div>
        <div style={{ color: '#888', fontSize: 13, maxWidth: 400, textAlign: 'center', lineHeight: 1.6 }}>
          The tailscale-admin service is not reachable at port 4000.
          <br />
          Start it with <code style={{ background: '#252525', padding: '2px 6px', borderRadius: 3 }}>npm run dev</code> in{' '}
          <code style={{ background: '#252525', padding: '2px 6px', borderRadius: 3 }}>tailscale-admin/service/</code>.
        </div>
      </div>
    );
  }

  if (!me?.isAdmin) {
    return (
      <div style={S.center}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#ffaa44', marginBottom: 12 }}>
          Access Denied
        </div>
        <div style={{ color: '#888', fontSize: 13, textAlign: 'center', lineHeight: 1.6 }}>
          Signed in as <strong style={{ color: '#e0e0e0' }}>{me?.user}</strong>
          <br />
          You must be in <code style={{ background: '#252525', padding: '2px 6px', borderRadius: 3 }}>group:admins</code> in the Tailscale ACL.
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a1a' }}>
      {/* Header */}
      <div style={S.header}>
        <span style={{ fontWeight: 700, color: '#5bbad5', fontSize: 15, letterSpacing: -0.3 }}>
          dataTail
        </span>
        <span style={{ color: '#3d3d3d', fontSize: 12 }}>|</span>
        <span style={{ color: '#888', fontSize: 13 }}>Tailscale Admin</span>
        <div style={{ flex: 1 }} />
        <div style={S.userBadge}>
          <div style={S.userDot} />
          <span style={{ fontSize: 12, color: '#b0b0b0' }}>{me.user}</span>
          <span
            style={{
              fontSize: 10,
              background: '#4a9eff22',
              color: '#4a9eff',
              padding: '2px 6px',
              borderRadius: 10,
              fontWeight: 600,
            }}
          >
            admin
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              ...S.tab,
              borderBottom: tab === t ? '2px solid #5bbad5' : '2px solid transparent',
              color: tab === t ? '#5bbad5' : '#666',
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '24px 32px', maxWidth: 960, margin: '0 auto' }}>
        {tab === 'devices' && <DeviceList />}
        {tab === 'groups' && <UserGroups />}
        {tab === 'acl' && <ACLViewer />}
      </div>
    </div>
  );
}

const S = {
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    gap: 8,
  },
  header: {
    height: 48,
    background: '#252525',
    borderBottom: '1px solid #2e2e2e',
    display: 'flex',
    alignItems: 'center',
    padding: '0 24px',
    gap: 12,
  },
  userBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  userDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#4aff4a',
  },
  tabs: {
    background: '#252525',
    borderBottom: '1px solid #2e2e2e',
    display: 'flex',
    padding: '0 24px',
    gap: 4,
  },
  tab: {
    padding: '10px 16px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'inherit',
    transition: 'color 0.1s',
  },
};
