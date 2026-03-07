import { useStore } from '../store';

export default function BottomBar() {
  const zoom = useStore((s) => s.zoom);
  const setZoom = useStore((s) => s.setZoom);
  const pan = useStore((s) => s.pan);
  const setPan = useStore((s) => s.setPan);

  const zoomPct = Math.round(zoom * 100);

  function handleZoomIn() {
    setZoom(Math.min(40, zoom * 1.2));
  }

  function handleZoomOut() {
    setZoom(Math.max(0.05, zoom / 1.2));
  }

  function handleFitToScreen() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  return (
    <div
      style={{
        height: 32,
        background: '#fff',
        borderTop: '1px solid #e5e5e5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        flexShrink: 0,
        userSelect: 'none',
        padding: '0 16px',
      }}
    >
      <button
        onClick={handleZoomOut}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#666',
          cursor: 'pointer',
          fontSize: 16,
          fontWeight: 700,
          width: 24,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 4,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f0f0'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        title="Zoom Out"
      >
        -
      </button>

      <span
        style={{
          fontSize: 12,
          color: '#666',
          minWidth: 48,
          textAlign: 'center',
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {zoomPct}%
      </span>

      <button
        onClick={handleZoomIn}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#666',
          cursor: 'pointer',
          fontSize: 16,
          fontWeight: 700,
          width: 24,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 4,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f0f0'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        title="Zoom In"
      >
        +
      </button>

      <div style={{ width: 1, height: 16, background: '#e5e5e5' }} />

      <button
        onClick={handleFitToScreen}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#666',
          cursor: 'pointer',
          fontSize: 11,
          padding: '3px 8px',
          borderRadius: 4,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f0f0'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        title="Fit to Screen"
      >
        Fit
      </button>
    </div>
  );
}
