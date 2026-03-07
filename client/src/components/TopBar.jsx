import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import * as api from '../api';

const USER_COLORS = [
  '#6C5CE7', '#00b894', '#e17055', '#0984e3', '#fdcb6e',
  '#e84393', '#00cec9', '#d63031',
];

function getUserColor(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.split(/[\s-_]+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function TopBar({
  onOpenDashboard,
  onOpenReview,
  onToggleAnnotationVisibility,
  onNavigateImage,
  annotationsVisible = true,
}) {
  const navigate = useNavigate();
  const currentProject = useStore((s) => s.currentProject);
  const connectedUsers = useStore((s) => s.connectedUsers);
  const currentUser = useStore((s) => s.currentUser);
  const images = useStore((s) => s.images);
  const currentImage = useStore((s) => s.currentImage);
  const annotations = useStore((s) => s.annotations);

  const [moreOpen, setMoreOpen] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);

  // Image index
  const currentIndex = currentImage
    ? images.findIndex((img) => img.id === currentImage.id)
    : -1;
  const totalImages = images.length;

  // Save handler
  async function handleSave() {
    setSaveFlash(true);
    try {
      // Persist all current annotations via batch update
      for (const ann of annotations) {
        if (ann.id && !String(ann.id).startsWith('temp-')) {
          await api.updateAnnotation(ann.id, {
            label: ann.label,
            data: ann.data,
          });
        }
      }
    } catch (err) {
      console.error('Save failed:', err);
    }
    setTimeout(() => setSaveFlash(false), 600);
  }

  return (
    <div
      style={{
        height: 52,
        background: '#fff',
        borderBottom: '1px solid #e5e5e5',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 12,
        flexShrink: 0,
        zIndex: 50,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Back arrow */}
      <button
        onClick={() => navigate('/')}
        title="Back to Projects"
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          background: '#f5f5f5',
          border: '1px solid #e5e5e5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#6C5CE7';
          e.currentTarget.style.borderColor = '#6C5CE7';
          e.currentTarget.querySelector('svg').style.stroke = '#fff';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#f5f5f5';
          e.currentTarget.style.borderColor = '#e5e5e5';
          e.currentTarget.querySelector('svg').style.stroke = '#555';
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* Breadcrumb + filename */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, marginLeft: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#888',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            onClick={() => navigate('/')}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#6C5CE7'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#888'; }}
          >
            {currentProject?.name || 'Project'}
          </span>
          <span style={{ fontSize: 12, color: '#ccc', userSelect: 'none' }}>&gt;</span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#6C5CE7',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            ANNOTATE
          </span>
        </div>
        <div
          style={{
            fontSize: 14,
            color: '#1a1a1a',
            fontWeight: 400,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 220,
            marginTop: 1,
          }}
        >
          {currentImage?.filename || 'No image selected'}
        </div>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Center: Image navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        {/* Left arrow */}
        <button
          onClick={() => onNavigateImage?.('prev')}
          disabled={currentIndex <= 0}
          title="Previous image"
          style={{
            width: 30,
            height: 30,
            borderRadius: 6,
            background: currentIndex <= 0 ? '#f9f9f9' : '#f5f5f5',
            border: '1px solid #e5e5e5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: currentIndex <= 0 ? 'default' : 'pointer',
            opacity: currentIndex <= 0 ? 0.4 : 1,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            if (currentIndex > 0) {
              e.currentTarget.style.background = '#6C5CE7';
              e.currentTarget.style.borderColor = '#6C5CE7';
              e.currentTarget.querySelector('svg').style.stroke = '#fff';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = currentIndex <= 0 ? '#f9f9f9' : '#f5f5f5';
            e.currentTarget.style.borderColor = '#e5e5e5';
            e.currentTarget.querySelector('svg').style.stroke = '#555';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Counter */}
        <span
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: '#1a1a1a',
            minWidth: 60,
            textAlign: 'center',
            userSelect: 'none',
          }}
        >
          {totalImages > 0 ? `${currentIndex + 1} / ${totalImages}` : '0 / 0'}
        </span>

        {/* Right arrow */}
        <button
          onClick={() => onNavigateImage?.('next')}
          disabled={currentIndex >= totalImages - 1}
          title="Next image"
          style={{
            width: 30,
            height: 30,
            borderRadius: 6,
            background: currentIndex >= totalImages - 1 ? '#f9f9f9' : '#f5f5f5',
            border: '1px solid #e5e5e5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: currentIndex >= totalImages - 1 ? 'default' : 'pointer',
            opacity: currentIndex >= totalImages - 1 ? 0.4 : 1,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            if (currentIndex < totalImages - 1) {
              e.currentTarget.style.background = '#6C5CE7';
              e.currentTarget.style.borderColor = '#6C5CE7';
              e.currentTarget.querySelector('svg').style.stroke = '#fff';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = currentIndex >= totalImages - 1 ? '#f9f9f9' : '#f5f5f5';
            e.currentTarget.style.borderColor = '#e5e5e5';
            e.currentTarget.querySelector('svg').style.stroke = '#555';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </button>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Right side controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Connected users (overlapping avatars) */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {connectedUsers
            .filter((u) => u !== currentUser)
            .slice(0, 5)
            .map((user, idx) => (
              <div
                key={user + idx}
                title={user}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: getUserColor(user),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#fff',
                  border: '2px solid #fff',
                  marginLeft: idx > 0 ? -8 : 0,
                  zIndex: 10 - idx,
                  position: 'relative',
                }}
              >
                {getInitials(user)}
              </div>
            ))}
        </div>

        {/* Separator */}
        {connectedUsers.filter((u) => u !== currentUser).length > 0 && (
          <div style={{ width: 1, height: 20, background: '#e5e5e5' }} />
        )}

        {/* Eye icon - toggle annotation visibility */}
        <button
          onClick={() => onToggleAnnotationVisibility?.()}
          title={annotationsVisible ? 'Hide annotations' : 'Show annotations'}
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            background: 'transparent',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s',
            opacity: annotationsVisible ? 1 : 0.4,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {annotationsVisible ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          )}
        </button>

        {/* Save / check button */}
        <button
          onClick={handleSave}
          title="Save annotations"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: saveFlash ? '#5a4bd6' : '#6C5CE7',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 1px 4px rgba(108, 92, 231, 0.3)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#5a4bd6'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = saveFlash ? '#5a4bd6' : '#6C5CE7'; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>

        {/* More options "..." button */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            title="More options"
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              background: 'transparent',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#555">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>

          {moreOpen && (
            <>
              <div
                onClick={() => setMoreOpen(false)}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 99,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 6,
                  background: '#fff',
                  border: '1px solid #e5e5e5',
                  borderRadius: 8,
                  minWidth: 180,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                  zIndex: 100,
                  overflow: 'hidden',
                }}
              >
                <div
                  onClick={() => { onOpenDashboard?.(); setMoreOpen(false); }}
                  style={{
                    padding: '10px 16px',
                    fontSize: 13,
                    color: '#1a1a1a',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  Dataset Health Dashboard
                </div>
                <div
                  onClick={() => { onOpenReview?.(); setMoreOpen(false); }}
                  style={{
                    padding: '10px 16px',
                    fontSize: 13,
                    color: '#1a1a1a',
                    cursor: 'pointer',
                    borderTop: '1px solid #f0f0f0',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  Quality Review
                </div>
                <div
                  onClick={() => { navigate('/'); setMoreOpen(false); }}
                  style={{
                    padding: '10px 16px',
                    fontSize: 13,
                    color: '#1a1a1a',
                    cursor: 'pointer',
                    borderTop: '1px solid #f0f0f0',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  Back to Projects
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
