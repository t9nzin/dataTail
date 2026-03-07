import { useStore } from '../store';

const ACCENT = '#6C5CE7';

function FitIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

export default function BottomBar() {
  const zoom = useStore((s) => s.zoom);
  const setZoom = useStore((s) => s.setZoom);
  const setPan = useStore((s) => s.setPan);

  const zoomPct = Math.round(zoom * 100);

  function handleZoomIn() {
    setZoom(Math.min(40, zoom * 1.2));
  }

  function handleZoomOut() {
    setZoom(Math.max(0.05, zoom / 1.2));
  }

  function handleReset() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: '#fff',
          border: `2px solid ${ACCENT}`,
          borderRadius: 40,
          padding: '6px 16px',
          boxShadow: '0 4px 20px rgba(108, 92, 231, 0.12)',
          userSelect: 'none',
        }}
      >
        <button
          onClick={handleZoomOut}
          style={{
            background: 'transparent',
            border: 'none',
            color: ACCENT,
            cursor: 'pointer',
            fontSize: 22,
            fontWeight: 700,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            padding: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(108,92,231,0.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          title="Zoom Out"
        >
          -
        </button>

        <span
          style={{
            fontSize: 16,
            color: '#1a1a1a',
            minWidth: 52,
            textAlign: 'center',
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {zoomPct}%
        </span>

        <button
          onClick={handleReset}
          title="Fit to Screen"
          style={{
            background: 'transparent',
            border: 'none',
            color: ACCENT,
            cursor: 'pointer',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            padding: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(108,92,231,0.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <FitIcon />
        </button>

        <button
          onClick={handleZoomIn}
          style={{
            background: 'transparent',
            border: 'none',
            color: ACCENT,
            cursor: 'pointer',
            fontSize: 22,
            fontWeight: 700,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            padding: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(108,92,231,0.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          title="Zoom In"
        >
          +
        </button>

        <span
          onClick={handleReset}
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: ACCENT,
            cursor: 'pointer',
            letterSpacing: 0.5,
            marginLeft: 4,
          }}
        >
          RESET
        </span>
      </div>
    </div>
  );
}
