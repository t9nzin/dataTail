import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import * as api from '../api';

// ── Constants ────────────────────────────────────────────────────────────────

const ACCENT = '#6C5CE7';
const ACCENT_BG = 'rgba(108, 92, 231, 0.10)';
const TEXT_PRIMARY = '#1a1a1a';
const TEXT_SECONDARY = '#888';
const TEXT_MUTED = '#aaa';
const BORDER = '#e8e8e8';
const BG = '#f4f5f7';

// ── Icons ────────────────────────────────────────────────────────────────────

function LogoIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <rect width="36" height="36" rx="10" fill={ACCENT} />
      <path d="M18 8l-8 14h5v6l8-14h-5v-6z" fill="white" opacity="0.9" />
    </svg>
  );
}

function NavProjectsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function NavDatasetsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function NavModelHubIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  );
}

function NavTeamIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function NavSettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function StatImagesIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function StatAnnotationsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#27ae60" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function StatReviewIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e67e22" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ListViewIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? ACCENT : '#bbb'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function GridViewIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? ACCENT : '#bbb'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function ImageSmallIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function TagSmallIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <circle cx="7" cy="7" r="1" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

// ── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'projects', label: 'Projects', Icon: NavProjectsIcon },
  { id: 'datasets', label: 'Datasets', Icon: NavDatasetsIcon },
  { id: 'team', label: 'Team', Icon: NavTeamIcon },
  { id: 'settings', label: 'Settings', Icon: NavSettingsIcon },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCount(n) {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1000) return n.toLocaleString();
  return String(n);
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, tintBg }) {
  return (
    <div
      style={{
        flex: 1,
        background: '#fff',
        borderRadius: 16,
        border: `1px solid ${BORDER}`,
        padding: '24px 28px',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: tintBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: TEXT_SECONDARY,
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 4,
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: TEXT_PRIMARY }}>
          {value}
        </div>
      </div>
    </div>
  );
}

// ── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({ project, onClick }) {
  const pct = project.image_count > 0
    ? Math.round(((project.done_count ?? 0) / project.image_count) * 100)
    : 0;
  const isDone = pct === 100;
  const barColor = isDone ? '#27ae60' : ACCENT;

  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        borderRadius: 18,
        border: `1px solid ${BORDER}`,
        cursor: 'pointer',
        transition: 'box-shadow 0.2s, transform 0.2s, border-color 0.2s',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(108,92,231,0.13)';
        e.currentTarget.style.borderColor = ACCENT;
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = BORDER;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Top section with thumbnail area */}
      <div
        style={{
          padding: '20px 24px 0',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 16,
        }}
      >
        {/* Thumbnail */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 12,
            background: `linear-gradient(135deg, ${ACCENT}18, ${ACCENT}38)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {project.thumbnail_image_id ? (
            <img
              src={`/api/images/${project.thumbnail_image_id}/file`}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 4 }}>
            {/* User avatar */}
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: ACCENT,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
                color: '#fff',
              }}
            >
              LU
            </div>
          </div>
        </div>
      </div>

      {/* Title + description */}
      <div style={{ padding: '12px 24px 0' }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: TEXT_PRIMARY,
            marginBottom: 6,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {project.name}
        </div>
        <div
          style={{
            fontSize: 13,
            color: TEXT_SECONDARY,
            lineHeight: 1.5,
            minHeight: 40,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {project.description || 'No description provided.'}
        </div>
      </div>

      {/* Stats row */}
      <div
        style={{
          padding: '14px 24px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          fontSize: 13,
          color: TEXT_SECONDARY,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <ImageSmallIcon />
          {formatCount(project.image_count ?? 0)}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: ACCENT }}>
          <TagSmallIcon />
          {project.annotation_count ?? 0} labels
        </span>
        <span style={{ marginLeft: 'auto', fontWeight: 600, color: isDone ? '#27ae60' : TEXT_SECONDARY }}>
          {isDone ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              DONE
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#27ae60" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          ) : (
            `${pct}%`
          )}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ padding: '8px 24px 0' }}>
        <div
          style={{
            height: 5,
            background: '#f0f0f0',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.max(pct, 2)}%`,
              height: '100%',
              background: barColor,
              borderRadius: 3,
              transition: 'width 0.3s',
            }}
          />
        </div>
      </div>

      {/* Action button */}
      <div style={{ padding: '16px 24px 20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '12px 0',
            borderRadius: 12,
            background: isDone ? 'transparent' : '#1a1a2e',
            color: isDone ? TEXT_PRIMARY : '#fff',
            border: isDone ? `1.5px solid ${BORDER}` : 'none',
            fontSize: 14,
            fontWeight: 600,
            transition: 'background 0.15s',
          }}
        >
          {isDone ? 'Export Labels' : 'Open Project'}
          {isDone ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          ) : (
            <ArrowRightIcon />
          )}
        </div>
      </div>
    </div>
  );
}

// ── New Dataset Card ─────────────────────────────────────────────────────────

function NewDatasetCard({ onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 18,
        border: `2px dashed #d5d5d5`,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        transition: 'border-color 0.2s, background 0.2s',
        background: 'transparent',
        minHeight: 320,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = ACCENT;
        e.currentTarget.style.background = 'rgba(108, 92, 231, 0.03)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#d5d5d5';
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          border: `2px solid #d5d5d5`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
          color: '#bbb',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 8 }}>
        New Dataset
      </div>
      <div style={{ fontSize: 13, color: TEXT_MUTED, textAlign: 'center', lineHeight: 1.5 }}>
        Start annotating a new<br />collection of images.
      </div>
    </div>
  );
}

// ── User Profile ────────────────────────────────────────────────────────────

function getInitials(identity) {
  if (identity.displayName) {
    const parts = identity.displayName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (identity.login && identity.login !== 'local-user') {
    // email-like: take first letter of local part
    const local = identity.login.split('@')[0];
    const parts = local.split(/[._-]+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return local.slice(0, 2).toUpperCase();
  }
  return 'LU';
}

function UserProfile() {
  const identity = useStore((s) => s.userIdentity);
  const initials = getInitials(identity);
  const name = identity.displayName || (identity.login !== 'local-user' ? identity.login : 'Local User');
  const subtitle = identity.displayName && identity.login !== 'local-user'
    ? identity.login
    : identity.tailnet || null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '16px 20px',
        borderTop: `1px solid ${BORDER}`,
      }}
    >
      {identity.profilePicUrl ? (
        <img
          src={identity.profilePicUrl}
          alt={name}
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            objectFit: 'cover',
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: ACCENT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 700,
            color: '#fff',
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 14,
          fontWeight: 600,
          color: TEXT_PRIMARY,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {name}
        </div>
        {subtitle && (
          <div style={{
            fontSize: 11,
            color: TEXT_SECONDARY,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function ProjectList() {
  const projects = useStore((s) => s.projects);
  const setProjects = useStore((s) => s.setProjects);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newLabels, setNewLabels] = useState('');
  const [imageFiles, setImageFiles] = useState([]);
  const [creating, setCreating] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [activeNav, setActiveNav] = useState('projects');
  const filesInputRef = useRef(null);
  const folderInputRef = useRef(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await api.fetchProjects();
        setProjects(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [setProjects]);

  function resetModal() {
    setNewName('');
    setNewDescription('');
    setNewLabels('');
    setImageFiles([]);
    setUploadStatus('');
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      setUploadStatus('Creating project...');
      const project = await api.createProject(newName.trim(), newDescription.trim());

      if (imageFiles.length > 0) {
        const BATCH = 50;
        for (let i = 0; i < imageFiles.length; i += BATCH) {
          const batch = imageFiles.slice(i, i + BATCH);
          setUploadStatus(`Uploading images ${i + 1}--${Math.min(i + BATCH, imageFiles.length)} of ${imageFiles.length}...`);
          await api.uploadImages(project.id, batch);
        }
      }

      const labelNames = newLabels.split(',').map((l) => l.trim()).filter(Boolean);
      if (labelNames.length > 0) {
        setUploadStatus('Creating label classes...');
        for (const name of labelNames) {
          await api.createLabel(project.id, name);
        }
      }

      setProjects([project, ...projects]);
      resetModal();
      setShowModal(false);
      navigate(`/project/${project.id}`);
    } catch (err) {
      setError(err.message);
      setUploadStatus('');
    } finally {
      setCreating(false);
    }
  }

  // Compute aggregate stats
  const totalImages = projects.reduce((s, p) => s + (p.image_count ?? 0), 0);
  const totalAnnotations = projects.reduce((s, p) => s + (p.annotation_count ?? 0), 0);
  const totalDone = projects.reduce((s, p) => s + (p.done_count ?? 0), 0);
  const annotationPct = totalImages > 0 ? ((totalDone / totalImages) * 100).toFixed(1) : '0.0';
  const reviewQueue = Math.max(0, totalImages - totalDone);

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: BG,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif',
        color: TEXT_PRIMARY,
        overflow: 'hidden',
      }}
    >
      {/* ── Left Sidebar ────────────────────────────────────────── */}
      <aside
        style={{
          width: 240,
          background: '#fff',
          borderRight: `1px solid ${BORDER}`,
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 50,
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '28px 24px 32px',
          }}
        >
          <LogoIcon />
          <span style={{ fontSize: 20, fontWeight: 700, color: TEXT_PRIMARY }}>dataTail</span>
        </div>

        {/* Nav items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 12px' }}>
          {NAV_ITEMS.map((item) => {
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 16px',
                  background: isActive ? ACCENT_BG : 'transparent',
                  color: isActive ? ACCENT : '#555',
                  border: 'none',
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontSize: 15,
                  fontWeight: isActive ? 600 : 400,
                  transition: 'background 0.15s, color 0.15s',
                  textAlign: 'left',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = '#f5f5f5';
                    e.currentTarget.style.color = TEXT_PRIMARY;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#555';
                  }
                }}
              >
                <item.Icon />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div style={{ flex: 1 }} />

        {/* Bottom: Usage */}
        <div style={{ padding: '0 16px 12px' }}>
          <div
            style={{
              background: 'rgba(108, 92, 231, 0.06)',
              borderRadius: 12,
              padding: '14px 16px',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: ACCENT,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                marginBottom: 6,
              }}
            >
              Usage
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: TEXT_PRIMARY }}>
                {formatCount(totalImages)} images
              </span>
            </div>
            <div
              style={{
                height: 4,
                background: 'rgba(108, 92, 231, 0.15)',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, totalImages > 0 ? (totalDone / totalImages) * 100 : 0)}%`,
                  height: '100%',
                  background: ACCENT,
                  borderRadius: 2,
                }}
              />
            </div>
          </div>
        </div>

        {/* Bottom: User */}
        <UserProfile />
      </aside>

      {/* ── Main Content ────────────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          marginLeft: 240,
          padding: '40px 48px 60px',
          height: '100vh',
          overflowY: 'auto',
        }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: TEXT_PRIMARY, margin: 0 }}>
              Project Workspace
            </h1>
            <p style={{ fontSize: 16, color: TEXT_SECONDARY, margin: '6px 0 0' }}>
              Manage your training data and annotation tasks.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, flexShrink: 0, marginTop: 4 }}>
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 22px',
                background: '#fff',
                color: TEXT_PRIMARY,
                border: `1.5px solid ${BORDER}`,
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#bbb'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; }}
            >
              <ImportIcon />
              Import
            </button>
            <button
              onClick={() => setShowModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 22px',
                background: ACCENT,
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                boxShadow: '0 2px 12px rgba(108, 92, 231, 0.3)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#5a4bd6'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = ACCENT; }}
            >
              <PlusIcon />
              Create Project
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 20, margin: '32px 0' }}>
          <StatCard
            icon={<StatImagesIcon />}
            label="Total Images"
            value={formatCount(totalImages)}
            tintBg="rgba(108, 92, 231, 0.08)"
          />
          <StatCard
            icon={<StatAnnotationsIcon />}
            label="Annotations"
            value={`${annotationPct}%`}
            tintBg="rgba(39, 174, 96, 0.08)"
          />
          <StatCard
            icon={<StatReviewIcon />}
            label="Review Queue"
            value={formatCount(reviewQueue)}
            tintBg="rgba(230, 126, 34, 0.08)"
          />
        </div>

        {error && (
          <div
            style={{
              padding: '14px 20px',
              background: 'rgba(231,76,60,0.06)',
              border: '1px solid rgba(231,76,60,0.2)',
              borderRadius: 12,
              color: '#e74c3c',
              fontSize: 14,
              marginBottom: 24,
            }}
          >
            {error}
          </div>
        )}

        {/* Recent Projects heading */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT_PRIMARY, margin: 0 }}>
            Recent Projects
          </h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 6,
              }}
            >
              <ListViewIcon active={false} />
            </button>
            <button
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 6,
              }}
            >
              <GridViewIcon active />
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ padding: '48px 0', color: TEXT_MUTED, fontSize: 16, textAlign: 'center' }}>
            Loading projects...
          </div>
        )}

        {/* Empty state */}
        {!loading && projects.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: TEXT_MUTED, fontSize: 15 }}>
            No projects yet. Click "New Project" to get started.
          </div>
        )}

        {/* Project cards grid */}
        {!loading && projects.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => navigate(`/project/${project.id}`)}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Create Project Modal ─────────────────────────────────── */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !creating) {
              setShowModal(false);
              resetModal();
            }
          }}
        >
          <div
            style={{
              width: 560,
              background: '#ffffff',
              borderRadius: 20,
              boxShadow: '0 12px 48px rgba(0,0,0,0.15)',
              overflow: 'hidden',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            {/* Header */}
            <div style={{ padding: '24px 28px 18px', borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: TEXT_PRIMARY }}>New Project</div>
              <div style={{ fontSize: 14, color: TEXT_SECONDARY, marginTop: 4 }}>
                Set up your annotation project with images and labels
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Project Name */}
              <div>
                <label style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY, display: 'block', marginBottom: 6 }}>
                  Project Name
                </label>
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' && !creating) { setShowModal(false); resetModal(); }
                  }}
                  placeholder="e.g. Street Signs Dataset"
                  disabled={creating}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#ffffff',
                    border: `1.5px solid ${BORDER}`,
                    borderRadius: 10,
                    color: TEXT_PRIMARY,
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = ACCENT; }}
                  onBlur={(e) => { e.target.style.borderColor = BORDER; }}
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY, display: 'block', marginBottom: 6 }}>
                  Description <span style={{ fontWeight: 400, color: TEXT_MUTED }}>(optional)</span>
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="What will this dataset be used for?"
                  rows={2}
                  disabled={creating}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#ffffff',
                    border: `1.5px solid ${BORDER}`,
                    borderRadius: 10,
                    color: TEXT_PRIMARY,
                    fontSize: 14,
                    outline: 'none',
                    resize: 'none',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = ACCENT; }}
                  onBlur={(e) => { e.target.style.borderColor = BORDER; }}
                />
              </div>

              {/* Class Labels */}
              <div>
                <label style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY, display: 'block', marginBottom: 6 }}>
                  Class Labels <span style={{ fontWeight: 400, color: TEXT_MUTED }}>(optional, comma-separated)</span>
                </label>
                <input
                  value={newLabels}
                  onChange={(e) => setNewLabels(e.target.value)}
                  placeholder="e.g. cat, dog, car, person"
                  disabled={creating}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#ffffff',
                    border: `1.5px solid ${BORDER}`,
                    borderRadius: 10,
                    color: TEXT_PRIMARY,
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                    fontFamily: 'inherit',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = ACCENT; }}
                  onBlur={(e) => { e.target.style.borderColor = BORDER; }}
                />
                {newLabels.trim() && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {newLabels.split(',').map((l) => l.trim()).filter(Boolean).map((label, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: 13,
                          padding: '3px 12px',
                          background: ACCENT_BG,
                          color: ACCENT,
                          borderRadius: 14,
                          fontWeight: 600,
                        }}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Image Upload */}
              <div>
                <label style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY, display: 'block', marginBottom: 6 }}>
                  Images <span style={{ fontWeight: 400, color: TEXT_MUTED }}>(optional)</span>
                </label>

                <input
                  ref={filesInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setImageFiles((prev) => {
                      const existing = new Set(prev.map((f) => f.name + f.size));
                      return [...prev, ...files.filter((f) => !existing.has(f.name + f.size))];
                    });
                    e.target.value = '';
                  }}
                />
                <input
                  ref={folderInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  webkitdirectory=""
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []).filter((f) =>
                      f.type.startsWith('image/')
                    );
                    setImageFiles((prev) => {
                      const existing = new Set(prev.map((f) => f.name + f.size));
                      return [...prev, ...files.filter((f) => !existing.has(f.name + f.size))];
                    });
                    e.target.value = '';
                  }}
                />

                {imageFiles.length === 0 ? (
                  <div
                    style={{
                      border: `2px dashed ${BORDER}`,
                      borderRadius: 12,
                      padding: '28px 20px',
                      textAlign: 'center',
                      background: '#fafafa',
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const files = Array.from(e.dataTransfer.files).filter((f) =>
                        f.type.startsWith('image/')
                      );
                      setImageFiles((prev) => {
                        const existing = new Set(prev.map((f) => f.name + f.size));
                        return [...prev, ...files.filter((f) => !existing.has(f.name + f.size))];
                      });
                    }}
                  >
                    <div style={{ fontSize: 14, color: TEXT_SECONDARY, marginBottom: 14 }}>
                      Drop images here, or
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                      <button
                        type="button"
                        onClick={() => filesInputRef.current?.click()}
                        style={{
                          padding: '8px 18px',
                          background: '#fff',
                          border: `1.5px solid ${BORDER}`,
                          borderRadius: 8,
                          color: TEXT_PRIMARY,
                          cursor: 'pointer',
                          fontSize: 13,
                          fontWeight: 500,
                          transition: 'border-color 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = ACCENT; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; }}
                      >
                        Select Images
                      </button>
                      <button
                        type="button"
                        onClick={() => folderInputRef.current?.click()}
                        style={{
                          padding: '8px 18px',
                          background: '#fff',
                          border: `1.5px solid ${BORDER}`,
                          borderRadius: 8,
                          color: TEXT_PRIMARY,
                          cursor: 'pointer',
                          fontSize: 13,
                          fontWeight: 500,
                          transition: 'border-color 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = ACCENT; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; }}
                      >
                        Select Folder
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      border: `1.5px solid ${BORDER}`,
                      borderRadius: 12,
                      padding: '14px 18px',
                      background: '#fafafa',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY }}>
                        {imageFiles.length} image{imageFiles.length !== 1 ? 's' : ''} selected
                      </div>
                      <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 }}>
                        {(imageFiles.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB total
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setImageFiles([])}
                      disabled={creating}
                      style={{
                        padding: '6px 14px',
                        background: 'transparent',
                        border: `1.5px solid ${BORDER}`,
                        borderRadius: 6,
                        color: TEXT_SECONDARY,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 28px 24px', borderTop: `1px solid ${BORDER}` }}>
              {creating && uploadStatus && (
                <div style={{ fontSize: 14, color: ACCENT, marginBottom: 12, textAlign: 'center', fontWeight: 500 }}>
                  {uploadStatus}
                </div>
              )}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setShowModal(false); resetModal(); }}
                  disabled={creating}
                  style={{
                    padding: '10px 24px',
                    background: '#fff',
                    color: TEXT_PRIMARY,
                    border: `1.5px solid ${BORDER}`,
                    borderRadius: 10,
                    cursor: creating ? 'default' : 'pointer',
                    fontSize: 14,
                    fontWeight: 500,
                    opacity: creating ? 0.5 : 1,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { if (!creating) e.currentTarget.style.background = '#f8f8f8'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || creating}
                  style={{
                    padding: '10px 28px',
                    background: newName.trim() && !creating ? ACCENT : '#e5e5e5',
                    color: newName.trim() && !creating ? '#ffffff' : TEXT_MUTED,
                    border: 'none',
                    borderRadius: 10,
                    cursor: newName.trim() && !creating ? 'pointer' : 'default',
                    fontSize: 14,
                    fontWeight: 600,
                    boxShadow: newName.trim() && !creating ? '0 2px 12px rgba(108, 92, 231, 0.25)' : 'none',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { if (newName.trim() && !creating) e.currentTarget.style.background = '#5a4bd6'; }}
                  onMouseLeave={(e) => { if (newName.trim() && !creating) e.currentTarget.style.background = ACCENT; }}
                >
                  {creating ? 'Setting up...' : 'Create Project'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
