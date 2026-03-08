import { useState, useRef, useMemo, useEffect } from 'react';
import { useStore } from '../store';
import * as api from '../api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseData(data) {
  if (!data) return null;
  if (typeof data === 'string') {
    try { return JSON.parse(data); } catch { return null; }
  }
  return data;
}

// ── Constants ────────────────────────────────────────────────────────────────

const ACCENT = '#6C5CE7';
const ACCENT_BG = 'rgba(108, 92, 231, 0.10)';
const BORDER = '#e5e5e5';
const TEXT_PRIMARY = '#555';
const TEXT_SECONDARY = '#888';
const TEXT_MUTED = '#aaa';

const SEVERITY_COLORS = {
  error: '#e74c3c',
  warning: '#f39c12',
  info: '#3498db',
};

const defaultColors = ['#4a9eff', '#ff4a4a', '#4aff4a', '#ffff4a', '#ff4aff', '#4affff', '#ff8c00', '#8c00ff'];

// ── Icon Components ──────────────────────────────────────────────────────────

const tabIconProps = {
  width: 36,
  height: 36,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function TagIcon() {
  return (
    <svg {...tabIconProps}>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <circle cx="7" cy="7" r="1" fill="currentColor" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg {...tabIconProps}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg {...tabIconProps}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg {...tabIconProps}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function SparkleSmallIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
      <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z" />
    </svg>
  );
}

function TrashSmallIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

// ── Sidebar Tab Definitions ──────────────────────────────────────────────────

const tabs = [
  { id: 'labels', label: 'Labels', Icon: TagIcon },
  { id: 'layers', label: 'Layers', Icon: LayersIcon },
  { id: 'images', label: 'Images', Icon: ImageIcon },
  { id: 'review', label: 'Review', Icon: ShieldIcon },
];

// ── Sub-Components ───────────────────────────────────────────────────────────

function TypeBadge({ type }) {
  return (
    <span
      style={{
        fontSize: 16,
        padding: '3px 10px',
        borderRadius: 4,
        background: '#f0f0f0',
        color: TEXT_SECONDARY,
        fontWeight: 500,
      }}
    >
      {type || 'unknown'}
    </span>
  );
}

// ── Labels Tab Content ───────────────────────────────────────────────────────

function LabelsPanel() {
  const annotations = useStore((s) => s.annotations);
  const aiResults = useStore((s) => s.aiResults);
  const selectedAnnotation = useStore((s) => s.selectedAnnotation);
  const setSelectedAnnotation = useStore((s) => s.setSelectedAnnotation);
  const removeAnnotation = useStore((s) => s.removeAnnotation);
  const labelClasses = useStore((s) => s.labelClasses);
  const setLabelClasses = useStore((s) => s.setLabelClasses);
  const activeLabel = useStore((s) => s.activeLabel);
  const setActiveLabel = useStore((s) => s.setActiveLabel);
  const currentProject = useStore((s) => s.currentProject);
  const currentImage = useStore((s) => s.currentImage);
  const isAiProcessing = useStore((s) => s.isAiProcessing);
  const setAiProcessing = useStore((s) => s.setAiProcessing);
  const setAiResults = useStore((s) => s.setAiResults);

  const [subTab, setSubTab] = useState('classes');
  const [addingLabel, setAddingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#4a9eff');

  // Count annotations per label class
  const classCounts = useMemo(() => {
    const counts = {};
    for (const ann of annotations) {
      const label = ann.label || 'unlabeled';
      counts[label] = (counts[label] || 0) + 1;
    }
    return counts;
  }, [annotations]);

  // Separate used and unused classes
  const usedClasses = labelClasses.filter((lc) => (classCounts[lc.name] || 0) > 0);
  const unusedClasses = labelClasses.filter((lc) => (classCounts[lc.name] || 0) === 0);

  function getLabelColor(labelName) {
    if (!labelName) return '#888';
    const lc = labelClasses.find((l) => l.name === labelName);
    if (lc?.color) return lc.color;
    const usedColors = new Set(labelClasses.map((c) => c.color?.toLowerCase()));
    const palette = defaultColors.filter((c) => !usedColors.has(c.toLowerCase()));
    const pool = palette.length > 0 ? palette : defaultColors;
    let hash = 0;
    for (let i = 0; i < labelName.length; i++) {
      hash = labelName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return pool[Math.abs(hash) % pool.length];
  }

  async function handleAddLabel() {
    if (!newLabelName.trim() || !currentProject) return;
    try {
      const label = await api.createLabel(currentProject.id, newLabelName.trim(), newLabelColor);
      setLabelClasses([...labelClasses, label]);
      if (!activeLabel) {
        setActiveLabel(label);
      }
      setNewLabelName('');
      setNewLabelColor('#4a9eff');
      setAddingLabel(false);
    } catch (err) {
      console.error('Failed to create label:', err);
    }
  }

  async function handleDelete(ann) {
    try {
      await api.deleteAnnotation(ann.id);
      removeAnnotation(ann.id);
      if (selectedAnnotation?.id === ann.id) {
        setSelectedAnnotation(null);
      }
    } catch (err) {
      console.error('Failed to delete annotation:', err);
    }
  }

  async function handleDeleteClass(lc) {
    if (!currentProject) return;
    try {
      await api.deleteLabel(lc.id, currentProject.id);
      setLabelClasses(labelClasses.filter((c) => c.id !== lc.id));
      if (activeLabel?.id === lc.id) {
        setActiveLabel(null);
      }
    } catch (err) {
      console.error('Failed to delete class:', err);
    }
  }

  async function handleSegmentEverything() {
    if (!currentImage?.id || isAiProcessing) return;
    setAiProcessing(true);
    try {
      const results = await api.segmentEverything(currentImage.id);
      if (results && Array.isArray(results)) {
        const suggestions = results.map((seg) => ({
          data: seg.polygon,
          polygon: seg.polygon,
          score: seg.predicted_iou,
          stability: seg.stability_score,
          area: seg.area,
          bbox: seg.bbox,
          rle: seg.rle,
          label: seg.label || null,
          source: 'sam-auto',
          type: 'polygon',
        }));
        setAiResults(suggestions);
      }
    } catch (err) {
      console.error('Segment everything failed:', err);
    } finally {
      setAiProcessing(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '24px 24px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 26, fontWeight: 700, color: TEXT_PRIMARY }}>Annotations</span>
          <span
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: ACCENT,
              background: ACCENT_BG,
              padding: '4px 14px',
              borderRadius: 14,
            }}
          >
            {annotations.length + aiResults.length}
          </span>
        </div>
        {activeLabel && (
          <div style={{ fontSize: 21, color: TEXT_SECONDARY, marginTop: 6 }}>
            Group: {activeLabel.name}
          </div>
        )}
      </div>

      {/* Sub-tabs: Classes | Layers */}
      <div
        style={{
          display: 'flex',
          borderBottom: `1px solid ${BORDER}`,
          margin: '0 24px',
        }}
      >
        {['classes', 'layers'].map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            style={{
              flex: 1,
              padding: '15px 0',
              fontSize: 22,
              fontWeight: subTab === tab ? 600 : 400,
              color: subTab === tab ? ACCENT : TEXT_SECONDARY,
              background: 'transparent',
              border: 'none',
              borderBottom: subTab === tab ? `3px solid ${ACCENT}` : '3px solid transparent',
              cursor: 'pointer',
              textTransform: 'capitalize',
              transition: 'color 0.15s',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 0' }}>
        {subTab === 'classes' && (
          <>
            {/* Active / used classes */}
            {labelClasses.map((lc) => {
              const count = classCounts[lc.name] || 0;
              const isActive = activeLabel?.id === lc.id;
              const isUnused = count === 0;
              if (isUnused) return null;

              return (
                <button
                  key={lc.id}
                  onClick={() => setActiveLabel(lc)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 18,
                    width: '100%',
                    padding: '12px 24px',
                    background: isActive ? ACCENT_BG : 'transparent',
                    border: 'none',
                    borderLeft: isActive ? `4px solid ${ACCENT}` : '4px solid transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = '#f8f8f8';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: lc.color || '#4a9eff',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 21,
                      color: isActive ? ACCENT : TEXT_PRIMARY,
                      fontWeight: isActive ? 600 : 400,
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {lc.name}
                  </span>
                  <span
                    style={{
                      fontSize: 18,
                      color: TEXT_SECONDARY,
                      background: '#f0f0f0',
                      padding: '3px 10px',
                      borderRadius: 12,
                      fontWeight: 500,
                    }}
                  >
                    {count}
                  </span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClass(lc);
                    }}
                    title="Delete class"
                    style={{
                      color: TEXT_MUTED,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: 6,
                      padding: 3,
                      transition: 'color 0.1s, background 0.1s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#e74c3c';
                      e.currentTarget.style.background = 'rgba(231,76,60,0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = TEXT_MUTED;
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <TrashSmallIcon />
                  </span>
                </button>
              );
            })}

            {/* Unused classes section */}
            {unusedClasses.length > 0 && (
              <>
                <div
                  style={{
                    fontSize: 21,
                    color: TEXT_PRIMARY,
                    padding: '21px 24px 9px',
                    fontWeight: 600,
                  }}
                >
                  Unused Classes
                </div>
                {unusedClasses.map((lc) => {
                  const isActive = activeLabel?.id === lc.id;
                  return (
                    <button
                      key={lc.id}
                      onClick={() => setActiveLabel(lc)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 18,
                        width: '100%',
                        padding: '12px 24px',
                        background: isActive ? ACCENT_BG : 'transparent',
                        border: 'none',
                        borderLeft: isActive ? `4px solid ${ACCENT}` : '4px solid transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        opacity: 0.6,
                        transition: 'background 0.1s, opacity 0.1s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '1';
                        if (!isActive) e.currentTarget.style.background = '#f8f8f8';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '0.6';
                        if (!isActive) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <span
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: lc.color || '#4a9eff',
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 21,
                          color: TEXT_MUTED,
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {lc.name}
                      </span>
                      <span
                        style={{
                          color: ACCENT,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        title="Auto-detect with AI"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveLabel(lc);
                          handleSegmentEverything();
                        }}
                      >
                        <SparkleSmallIcon />
                      </span>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClass(lc);
                        }}
                        title="Delete class"
                        style={{
                          color: TEXT_MUTED,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: 6,
                          padding: 3,
                          transition: 'color 0.1s, background 0.1s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#e74c3c';
                          e.currentTarget.style.background = 'rgba(231,76,60,0.08)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = TEXT_MUTED;
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <TrashSmallIcon />
                      </span>
                    </button>
                  );
                })}
              </>
            )}

            {labelClasses.length === 0 && (
              <div style={{ padding: '36px 24px', color: TEXT_MUTED, fontSize: 20, textAlign: 'center' }}>
                No classes defined yet
              </div>
            )}
          </>
        )}

        {subTab === 'layers' && (
          <LayersList />
        )}
      </div>

      {/* Bottom actions */}
      <div style={{ padding: '18px 24px', borderTop: `1px solid ${BORDER}` }}>
        {addingLabel ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              autoFocus
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddLabel();
                if (e.key === 'Escape') setAddingLabel(false);
              }}
              placeholder="Class name"
              style={{
                width: '100%',
                fontSize: 21,
                padding: '12px 15px',
                background: '#fff',
                border: `1px solid ${BORDER}`,
                borderRadius: 9,
                color: TEXT_PRIMARY,
                outline: 'none',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = ACCENT; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = BORDER; }}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {defaultColors.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewLabelColor(c)}
                  style={{
                    width: 33,
                    height: 33,
                    borderRadius: 6,
                    background: c,
                    border: newLabelColor === c ? `2px solid ${TEXT_PRIMARY}` : '2px solid transparent',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'border-color 0.1s',
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              <button
                onClick={handleAddLabel}
                style={{
                  flex: 1,
                  fontSize: 20,
                  padding: '12px 18px',
                  background: ACCENT,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 9,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Add
              </button>
              <button
                onClick={() => setAddingLabel(false)}
                style={{
                  fontSize: 20,
                  padding: '12px 18px',
                  background: '#f0f0f0',
                  color: TEXT_SECONDARY,
                  border: 'none',
                  borderRadius: 9,
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={() => setAddingLabel(true)}
              style={{
                width: '100%',
                padding: '15px',
                fontSize: 21,
                fontWeight: 500,
                background: '#f8f8f8',
                color: TEXT_PRIMARY,
                border: `1px dashed ${BORDER}`,
                borderRadius: 9,
                cursor: 'pointer',
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f0f0f0';
                e.currentTarget.style.borderColor = '#ccc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f8f8f8';
                e.currentTarget.style.borderColor = BORDER;
              }}
            >
              + Add Class
            </button>
            <button
              onClick={handleSegmentEverything}
              disabled={!currentImage || isAiProcessing}
              style={{
                width: '100%',
                padding: '15px',
                fontSize: 21,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 9,
                background: 'transparent',
                color: !currentImage ? TEXT_MUTED : ACCENT,
                border: `1.5px solid ${!currentImage ? BORDER : ACCENT}`,
                borderRadius: 9,
                cursor: !currentImage || isAiProcessing ? 'default' : 'pointer',
                opacity: !currentImage ? 0.5 : 1,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                if (currentImage && !isAiProcessing) e.currentTarget.style.background = ACCENT_BG;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <SparkleSmallIcon />
              {isAiProcessing ? 'Finding Objects...' : 'Find Objects with AI'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Layers List (shared between Labels sub-tab "layers" and Layers main tab) ─

function LayersList() {
  const annotations = useStore((s) => s.annotations);
  const aiResults = useStore((s) => s.aiResults);
  const setAiResults = useStore((s) => s.setAiResults);
  const addAnnotation = useStore((s) => s.addAnnotation);
  const currentImage = useStore((s) => s.currentImage);
  const activeLabel = useStore((s) => s.activeLabel);
  const selectedAnnotation = useStore((s) => s.selectedAnnotation);
  const setSelectedAnnotation = useStore((s) => s.setSelectedAnnotation);
  const removeAnnotation = useStore((s) => s.removeAnnotation);
  const updateAnnotation = useStore((s) => s.updateAnnotation);
  const labelClasses = useStore((s) => s.labelClasses);

  const [editingLabelId, setEditingLabelId] = useState(null);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!editingLabelId) return;
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setEditingLabelId(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [editingLabelId]);

  function getLabelColor(labelName) {
    if (!labelName) return '#888';
    const lc = labelClasses.find((l) => l.name === labelName);
    if (lc?.color) return lc.color;
    const usedColors = new Set(labelClasses.map((c) => c.color?.toLowerCase()));
    const palette = defaultColors.filter((c) => !usedColors.has(c.toLowerCase()));
    const pool = palette.length > 0 ? palette : defaultColors;
    let hash = 0;
    for (let i = 0; i < labelName.length; i++) {
      hash = labelName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return pool[Math.abs(hash) % pool.length];
  }

  async function handleRelabel(ann, newLabelName) {
    setEditingLabelId(null);
    if (newLabelName === ann.label) return;
    try {
      await api.updateAnnotation(ann.id, { label: newLabelName });
      updateAnnotation(ann.id, { label: newLabelName });
      if (selectedAnnotation?.id === ann.id) {
        setSelectedAnnotation({ ...ann, label: newLabelName });
      }
    } catch (err) {
      console.error('Failed to relabel annotation:', err);
    }
  }

  async function handleDelete(ann) {
    try {
      await api.deleteAnnotation(ann.id);
      removeAnnotation(ann.id);
      if (selectedAnnotation?.id === ann.id) {
        setSelectedAnnotation(null);
      }
    } catch (err) {
      console.error('Failed to delete annotation:', err);
    }
  }

  async function acceptAiResult(result, index) {
    if (!currentImage?.id) return;
    const polygon = parseData(result.data || result.polygon);
    const newAnn = {
      image_id: currentImage.id,
      project_id: currentImage.project_id,
      label: result.label || activeLabel?.name || null,
      type: 'polygon',
      data: polygon,
      source: 'sam-auto',
    };
    try {
      const saved = await api.createAnnotation(newAnn);
      addAnnotation(saved);
    } catch (err) {
      console.error('Failed to save AI annotation:', err);
      addAnnotation({ ...newAnn, id: 'temp-' + Date.now() });
    }
    setAiResults(aiResults.filter((_, i) => i !== index));
  }

  function rejectAiResult(index) {
    setAiResults(aiResults.filter((_, i) => i !== index));
  }

  async function handleAcceptAll() {
    if (!currentImage?.id) return;
    for (const result of aiResults) {
      const polygon = parseData(result.data || result.polygon);
      const newAnn = {
        image_id: currentImage.id,
        project_id: currentImage.project_id,
        label: result.label || activeLabel?.name || null,
        type: 'polygon',
        data: polygon,
        source: 'sam-auto',
      };
      try {
        const saved = await api.createAnnotation(newAnn);
        addAnnotation(saved);
      } catch (err) {
        addAnnotation({ ...newAnn, id: 'temp-' + Date.now() });
      }
    }
    setAiResults([]);
  }

  function handleRejectAll() {
    setAiResults([]);
  }

  if (annotations.length === 0 && aiResults.length === 0) {
    return (
      <div style={{ padding: '36px 24px', color: TEXT_MUTED, fontSize: 20, textAlign: 'center' }}>
        No annotations yet
      </div>
    );
  }

  return (
    <>
      {/* AI suggestions section */}
      {aiResults.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px 6px' }}>
            <span style={{ fontSize: 18, color: TEXT_SECONDARY, fontWeight: 500 }}>
              AI Suggestions ({aiResults.length})
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={handleAcceptAll}
                style={{ fontSize: 16, padding: '5px 12px', background: 'rgba(46,204,113,0.1)', border: '1px solid rgba(46,204,113,0.3)', borderRadius: 6, color: '#27ae60', cursor: 'pointer', fontWeight: 500 }}
              >
                Accept All
              </button>
              <button
                onClick={handleRejectAll}
                style={{ fontSize: 16, padding: '5px 12px', background: 'rgba(231,76,60,0.06)', border: '1px solid rgba(231,76,60,0.2)', borderRadius: 6, color: '#e74c3c', cursor: 'pointer', fontWeight: 500 }}
              >
                Reject All
              </button>
            </div>
          </div>
          {aiResults.map((result, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 24px',
                background: 'rgba(108, 92, 231, 0.04)',
                borderLeft: '4px solid rgba(108, 92, 231, 0.3)',
                borderBottom: '1px solid #f5f5f5',
              }}
            >
              <span style={{ width: 15, height: 15, borderRadius: '50%', background: '#6C5CE7', flexShrink: 0, opacity: 0.6 }} />
              <span style={{ fontSize: 20, color: TEXT_SECONDARY, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {result.label || 'unlabeled'}
              </span>
              <span style={{ fontSize: 15, padding: '3px 9px', borderRadius: 4, background: ACCENT_BG, color: ACCENT, fontWeight: 600, flexShrink: 0 }}>AI</span>
              <button
                onClick={() => acceptAiResult(result, index)}
                title="Accept"
                style={{ background: 'transparent', border: 'none', color: '#27ae60', cursor: 'pointer', padding: '3px 5px', fontSize: 21, lineHeight: 1, flexShrink: 0 }}
              >
                ✓
              </button>
              <button
                onClick={() => rejectAiResult(index)}
                title="Reject"
                style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: '3px 5px', fontSize: 21, lineHeight: 1, flexShrink: 0 }}
              >
                ✕
              </button>
            </div>
          ))}
          {annotations.length > 0 && (
            <div style={{ height: 9, borderBottom: '1px solid #eee', marginBottom: 3 }} />
          )}
        </>
      )}

      {/* Confirmed annotations */}
      {annotations.map((ann) => {
        const isSelected = selectedAnnotation?.id === ann.id;
        const isEditing = editingLabelId === ann.id;
        return (
          <div
            key={ann.id}
            onClick={() => setSelectedAnnotation(ann)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              padding: '12px 24px',
              cursor: 'pointer',
              background: isSelected ? ACCENT_BG : 'transparent',
              borderLeft: isSelected ? `4px solid ${ACCENT}` : '4px solid transparent',
              transition: 'background 0.1s',
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              if (!isSelected) e.currentTarget.style.background = '#f8f8f8';
            }}
            onMouseLeave={(e) => {
              if (!isSelected) e.currentTarget.style.background = 'transparent';
            }}
          >
            <span
              style={{
                width: 15,
                height: 15,
                borderRadius: '50%',
                background: getLabelColor(ann.label),
                flexShrink: 0,
              }}
            />
            {/* Label name — click to open class picker */}
            <span
              onClick={(e) => {
                e.stopPropagation();
                setEditingLabelId(isEditing ? null : ann.id);
              }}
              title="Click to reassign class"
              style={{
                fontSize: 21,
                color: isSelected ? ACCENT : TEXT_PRIMARY,
                fontWeight: isSelected ? 600 : 400,
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                borderRadius: 6,
                padding: '2px 6px',
                margin: '-2px -6px',
                transition: 'background 0.1s',
                background: isEditing ? '#f0f0f0' : 'transparent',
              }}
              onMouseEnter={(e) => { if (!isEditing) e.currentTarget.style.background = '#eef2ff'; }}
              onMouseLeave={(e) => { if (!isEditing) e.currentTarget.style.background = 'transparent'; }}
            >
              {ann.label || 'unlabeled'}
              <span style={{ fontSize: 14, marginLeft: 4, color: TEXT_MUTED, verticalAlign: 'middle' }}>▾</span>
            </span>

            {/* Class picker dropdown */}
            {isEditing && (
              <div
                ref={dropdownRef}
                style={{
                  position: 'absolute',
                  left: 42,
                  top: '100%',
                  zIndex: 50,
                  background: '#fff',
                  border: '1px solid #e5e5e5',
                  borderRadius: 9,
                  boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
                  minWidth: 240,
                  maxHeight: 300,
                  overflowY: 'auto',
                  padding: '6px 0',
                }}
              >
                {labelClasses.map((lc) => (
                  <div
                    key={lc.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRelabel(ann, lc.name);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 18px',
                      cursor: 'pointer',
                      fontSize: 20,
                      color: ann.label === lc.name ? ACCENT : TEXT_PRIMARY,
                      fontWeight: ann.label === lc.name ? 600 : 400,
                      background: ann.label === lc.name ? ACCENT_BG : 'transparent',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => {
                      if (ann.label !== lc.name) e.currentTarget.style.background = '#f8f8f8';
                    }}
                    onMouseLeave={(e) => {
                      if (ann.label !== lc.name) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: lc.color || '#888', flexShrink: 0 }} />
                    {lc.name}
                  </div>
                ))}
                {labelClasses.length === 0 && (
                  <div style={{ padding: '12px 18px', fontSize: 18, color: TEXT_MUTED }}>
                    No classes defined
                  </div>
                )}
              </div>
            )}

            <TypeBadge type={ann.type} />
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(ann);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: TEXT_MUTED,
                cursor: 'pointer',
                padding: 3,
                display: 'flex',
                alignItems: 'center',
                borderRadius: 6,
                transition: 'color 0.1s, background 0.1s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#e74c3c';
                e.currentTarget.style.background = 'rgba(231,76,60,0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = TEXT_MUTED;
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <TrashSmallIcon />
            </button>
          </div>
        );
      })}
    </>
  );
}

// ── Layers Tab Content (standalone panel) ────────────────────────────────────

function LayersPanel() {
  const annotations = useStore((s) => s.annotations);
  const aiResults = useStore((s) => s.aiResults);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '24px 24px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 26, fontWeight: 700, color: TEXT_PRIMARY }}>Layers</span>
          <span
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: ACCENT,
              background: ACCENT_BG,
              padding: '4px 14px',
              borderRadius: 14,
            }}
          >
            {annotations.length + aiResults.length}
          </span>
        </div>
        <div style={{ fontSize: 21, color: TEXT_SECONDARY, marginTop: 6 }}>
          Individual annotations for current image
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        <LayersList />
      </div>
    </div>
  );
}

// ── Images Tab Content ───────────────────────────────────────────────────────

function ImagesPanel() {
  const images = useStore((s) => s.images);
  const currentImage = useStore((s) => s.currentImage);
  const setCurrentImage = useStore((s) => s.setCurrentImage);
  const currentProject = useStore((s) => s.currentProject);
  const setImages = useStore((s) => s.setImages);
  const setAnnotations = useStore((s) => s.setAnnotations);
  const setSelectedAnnotation = useStore((s) => s.setSelectedAnnotation);
  const fileInputRef = useRef(null);

  async function handleImageClick(img) {
    setCurrentImage(img);
    setSelectedAnnotation(null);
    try {
      const anns = await api.fetchAnnotations(img.id);
      setAnnotations(anns);
    } catch (err) {
      console.error('Failed to fetch annotations:', err);
    }
  }

  async function handleUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentProject) return;
    try {
      await api.uploadImages(currentProject.id, files);
      const updated = await api.fetchImages(currentProject.id);
      setImages(updated);
    } catch (err) {
      console.error('Failed to upload images:', err);
    }
    e.target.value = '';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '24px 24px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 26, fontWeight: 700, color: TEXT_PRIMARY }}>Images</span>
          <span
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: ACCENT,
              background: ACCENT_BG,
              padding: '4px 14px',
              borderRadius: 14,
            }}
          >
            {images.length}
          </span>
        </div>
      </div>

      <div style={{ padding: '0 24px 15px' }}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleUpload}
          style={{ display: 'none' }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: '100%',
            padding: '15px',
            background: 'transparent',
            border: `1.5px dashed ${ACCENT}`,
            borderRadius: 12,
            color: ACCENT,
            cursor: 'pointer',
            fontSize: 21,
            fontWeight: 500,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = ACCENT_BG; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          + Upload Images
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {images.length === 0 && (
          <div style={{ padding: '36px 24px', color: TEXT_MUTED, fontSize: 20, textAlign: 'center' }}>
            No images uploaded yet
          </div>
        )}

        {images.map((img) => {
          const isCurrent = currentImage?.id === img.id;
          return (
            <div
              key={img.id}
              onClick={() => handleImageClick(img)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 15,
                padding: '9px 24px',
                cursor: 'pointer',
                background: isCurrent ? ACCENT_BG : 'transparent',
                borderLeft: isCurrent ? `4px solid ${ACCENT}` : '4px solid transparent',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => {
                if (!isCurrent) e.currentTarget.style.background = '#f8f8f8';
              }}
              onMouseLeave={(e) => {
                if (!isCurrent) e.currentTarget.style.background = 'transparent';
              }}
            >
              <div
                style={{
                  width: 66,
                  height: 66,
                  borderRadius: 9,
                  background: '#f0f0f0',
                  overflow: 'hidden',
                  flexShrink: 0,
                  border: isCurrent ? `2px solid ${ACCENT}` : '2px solid transparent',
                }}
              >
                <img
                  src={img.thumbnail_url || img.url || `/api/images/${img.id}/file`}
                  alt={img.filename}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div
                  style={{
                    fontSize: 21,
                    color: isCurrent ? ACCENT : TEXT_PRIMARY,
                    fontWeight: isCurrent ? 600 : 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {img.filename || `Image ${img.id}`}
                </div>
                {img.annotation_count != null && (
                  <div style={{ fontSize: 18, color: TEXT_SECONDARY }}>
                    {img.annotation_count} annotation{img.annotation_count !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
              {img.annotation_count != null && img.annotation_count > 0 && (
                <span
                  style={{
                    fontSize: 16,
                    background: ACCENT_BG,
                    color: ACCENT,
                    padding: '3px 12px',
                    borderRadius: 14,
                    fontWeight: 600,
                  }}
                >
                  {img.annotation_count}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── AI Review Tab Content ────────────────────────────────────────────────────

// Step indices
const REVIEW_STEPS = [
  { label: 'Loading ML models' },
  { label: null }, // dynamic: "Analyzing image X of N"
  { label: 'Checking label consistency' },
  { label: 'Generating report' },
];

function ReviewProgressCard({ currentStep, imageProgress, totalImages }) {
  const steps = [
    'Loading ML models',
    totalImages > 0 ? `Analyzing image ${imageProgress} of ${totalImages}` : 'Analyzing images',
    'Checking label consistency',
    'Generating report',
  ];

  return (
    <div style={{
      margin: '0 18px 18px',
      padding: '24px 24px 20px',
      background: '#fff',
      borderRadius: 16,
      border: '1px solid #ebebeb',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 4 }}>
        Annotation Check
      </div>
      <div style={{ fontSize: 17, color: TEXT_MUTED, marginBottom: 22 }}>
        Using AI to verify your annotations
      </div>
      {steps.map((label, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        const pending = i > currentStep;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: i < steps.length - 1 ? 16 : 0 }}>
            {/* Icon */}
            {done && (
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: 'rgba(46,204,113,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="#27ae60" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
            {active && (
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                border: `2.5px solid ${ACCENT}`,
                borderTopColor: 'transparent',
                flexShrink: 0,
                animation: 'spin 0.75s linear infinite',
              }} />
            )}
            {pending && (
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                border: '2px solid #ddd',
                flexShrink: 0,
              }} />
            )}
            {/* Label */}
            <span style={{
              fontSize: 19,
              fontWeight: active ? 600 : 400,
              color: done ? TEXT_SECONDARY : active ? ACCENT : TEXT_MUTED,
            }}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ReviewTabPanel() {
  const currentProject = useStore((s) => s.currentProject);
  const images = useStore((s) => s.images);
  const labelClasses = useStore((s) => s.labelClasses);
  const reviewIssues = useStore((s) => s.reviewIssues);
  const reviewHasRun = useStore((s) => s.reviewHasRun);
  const setReviewIssues = useStore((s) => s.setReviewIssues);
  const setReviewHasRun = useStore((s) => s.setReviewHasRun);
  const updateAnnotation = useStore((s) => s.updateAnnotation);
  const removeAnnotation = useStore((s) => s.removeAnnotation);
  const setSelectedAnnotation = useStore((s) => s.setSelectedAnnotation);
  const setCurrentImage = useStore((s) => s.setCurrentImage);
  const setHighlightRegion = useStore((s) => s.setHighlightRegion);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Progress state: step 0=models, 1=analyzing images, 2=label check, 3=report
  const [reviewStep, setReviewStep] = useState(0);
  const [imageProgress, setImageProgress] = useState(0);

  async function handleRunReview() {
    if (!currentProject) return;
    setLoading(true);
    setError(null);
    setReviewStep(0);
    setImageProgress(0);
    // Clear previous issues at start
    setReviewIssues([]);

    try {
      const projectLabels = labelClasses.map((lc) => lc.name);
      const totalImages = images.length;

      // Step 0 → 1: "Loading ML models" completes when first request fires
      setReviewStep(1);

      // Clear old DB issues for this project before starting
      await api.clearReviewIssues(currentProject.id);
      const allIssues = [];

      for (let i = 0; i < totalImages; i++) {
        setImageProgress(i + 1);
        // step 1 = analyzing images; step 2 = label consistency check
        // We blend: first half is step 1, second half bumps to step 2
        if (i === Math.floor(totalImages / 2)) setReviewStep(2);

        const img = images[i];
        try {
          const result = await api.qualityReviewImage(img.id, currentProject.id, projectLabels);
          if (result.issues) allIssues.push(...result.issues);
        } catch (err) {
          console.warn(`Review failed for image ${img.id}:`, err.message);
        }
      }

      // Step 3: generating report
      setReviewStep(3);
      await new Promise((r) => setTimeout(r, 400)); // brief pause so step 3 is visible

      setReviewIssues(allIssues);
      setReviewHasRun(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAcceptFix(issue, idx) {
    if (issue.fix) {
      try {
        if (issue.fix.action === 'delete' && issue.fix.annotation_id) {
          await api.deleteAnnotation(issue.fix.annotation_id);
          removeAnnotation(issue.fix.annotation_id);
        } else if (issue.fix.action === 'update' && issue.fix.annotation_id && issue.fix.data) {
          await api.updateAnnotation(issue.fix.annotation_id, issue.fix.data);
          updateAnnotation(issue.fix.annotation_id, issue.fix.data);
        }
      } catch (err) {
        console.error('Failed to apply fix:', err);
      }
    }
    setReviewIssues(reviewIssues.filter((_, i) => i !== idx));
  }

  function handleDismiss(idx) {
    setReviewIssues(reviewIssues.filter((_, i) => i !== idx));
  }

  function handleView(issue) {
    // Navigate to the issue's image first
    if (issue.image_id) {
      const img = images.find((i) => i.id === issue.image_id);
      if (img) setCurrentImage(img);
    }
    // For label mismatch: select the annotation
    if (issue.annotation_id) {
      // Small delay so annotations load for the new image
      setTimeout(() => {
        const ann = useStore.getState().annotations.find((a) => a.id === issue.annotation_id);
        if (ann) setSelectedAnnotation(ann);
      }, 100);
    }
    // For missing annotation: show highlight region
    if (issue.bbox && !issue.annotation_id) {
      setTimeout(() => {
        setHighlightRegion({
          x1: issue.bbox[0], y1: issue.bbox[1],
          x2: issue.bbox[2], y2: issue.bbox[3],
          label: issue.predicted_label || 'Unknown',
        });
      }, 100);
    }
  }

  const sortedIssues = [...reviewIssues].sort((a, b) => {
    const order = { error: 0, warning: 1, info: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  // Determine empty state message
  const emptyMessage = (() => {
    if (!currentProject) return 'Select a project to run quality review';
    if (reviewIssues.length === 0) return null; // show success banner instead
    if (sortedIssues.length === 0) return 'All issues resolved';
    return null;
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '24px 24px 18px' }}>
        <span style={{ fontSize: 26, fontWeight: 700, color: TEXT_PRIMARY }}>AI Review</span>
        <div style={{ fontSize: 21, color: TEXT_SECONDARY, marginTop: 6 }}>
          Check label quality across all images
        </div>
      </div>

      <div style={{ padding: '0 24px 15px' }}>
        <button
          onClick={handleRunReview}
          disabled={loading || !currentProject}
          style={{
            width: '100%',
            padding: '15px',
            fontSize: 21,
            fontWeight: 600,
            background: loading ? '#f0f0f0' : ACCENT,
            color: loading ? TEXT_SECONDARY : '#fff',
            border: 'none',
            borderRadius: 9,
            cursor: loading || !currentProject ? 'default' : 'pointer',
            opacity: !currentProject ? 0.5 : 1,
            transition: 'background 0.15s',
          }}
        >
          {loading ? `Reviewing... (${imageProgress}/${images.length})` : 'Run Quality Review'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 12px' }}>
        {error && (
          <div
            style={{
              margin: '0 24px 12px',
              padding: '15px 18px',
              background: 'rgba(231,76,60,0.06)',
              border: '1px solid rgba(231,76,60,0.2)',
              borderRadius: 9,
              color: '#e74c3c',
              fontSize: 20,
            }}
          >
            {error}
          </div>
        )}

        {reviewHasRun && reviewIssues.length === 0 && sortedIssues.length === 0 && !loading && (
          <div
            style={{
              margin: '0 24px 12px',
              padding: '18px 18px',
              background: 'rgba(46,204,113,0.08)',
              border: '1px solid rgba(46,204,113,0.25)',
              borderRadius: 9,
              color: '#27ae60',
              fontSize: 20,
              textAlign: 'center',
              fontWeight: 600,
            }}
          >
            All annotations look good!
          </div>
        )}

        {emptyMessage && (
          <div style={{ textAlign: 'center', color: TEXT_MUTED, padding: '48px 24px', fontSize: 20 }}>
            {emptyMessage}
          </div>
        )}

        {loading && (
          <ReviewProgressCard
            currentStep={reviewStep}
            imageProgress={imageProgress}
            totalImages={images.length}
          />
        )}

        {sortedIssues.map((issue, idx) => {
          const severity = issue.severity || 'info';
          const color = SEVERITY_COLORS[severity] || '#888';
          const isClickable = issue.annotation_id || issue.bbox;
          return (
            <div
              key={idx}
              onClick={() => handleView(issue)}
              style={{
                margin: '0 18px 9px',
                padding: '15px 18px',
                background: '#fafafa',
                borderRadius: 12,
                border: `1px solid ${color}33`,
                cursor: isClickable ? 'pointer' : 'default',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: color,
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 17, color: TEXT_MUTED }}>
                  {issue.image_filename || (severity === 'error' ? 'Label mismatch' : 'Missing annotation')}
                </span>
              </div>
              <div style={{ fontSize: 20, color: TEXT_PRIMARY, marginBottom: 6, lineHeight: 1.4 }}>
                {issue.message}
              </div>
              {issue.suggestion && (
                <div style={{ fontSize: 18, color: TEXT_SECONDARY, marginBottom: 12 }}>
                  {issue.suggestion}
                </div>
              )}
              <div style={{ display: 'flex', gap: 9 }}>
                {issue.fix && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAcceptFix(issue, idx); }}
                    style={{
                      padding: '8px 15px',
                      background: 'rgba(46,204,113,0.08)',
                      border: '1px solid rgba(46,204,113,0.3)',
                      borderRadius: 6,
                      color: '#27ae60',
                      cursor: 'pointer',
                      fontSize: 18,
                      fontWeight: 500,
                    }}
                  >
                    Accept Fix
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleDismiss(idx); }}
                  style={{
                    padding: '8px 15px',
                    background: '#f0f0f0',
                    border: '1px solid #e5e5e5',
                    borderRadius: 6,
                    color: TEXT_SECONDARY,
                    cursor: 'pointer',
                    fontSize: 18,
                    fontWeight: 500,
                  }}
                >
                  Dismiss
                </button>
                {isClickable && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleView(issue); }}
                    style={{
                      padding: '8px 15px',
                      background: ACCENT_BG,
                      border: `1px solid rgba(108,92,231,0.3)`,
                      borderRadius: 6,
                      color: ACCENT,
                      cursor: 'pointer',
                      fontSize: 18,
                      fontWeight: 500,
                    }}
                  >
                    View
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Sidebar Component ───────────────────────────────────────────────────

export default function Sidebar({ uiScale = 1 }) {
  const [activeTab, setActiveTab] = useState('labels');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        flexShrink: 0,
        height: '100%',
        borderRight: `1px solid ${BORDER}`,
        zoom: uiScale,
      }}
    >
      {/* Part A: Icon Tab Bar */}
      <div
        style={{
          width: 108,
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 15,
          gap: 6,
          flexShrink: 0,
          userSelect: 'none',
          borderRight: `1px solid ${BORDER}`,
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                width: 102,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '15px 0 12px',
                background: 'transparent',
                color: isActive ? ACCENT : '#999',
                border: 'none',
                borderLeft: isActive ? `4px solid ${ACCENT}` : '4px solid transparent',
                borderRadius: 0,
                cursor: 'pointer',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = '#555';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = '#999';
              }}
            >
              <div
                style={{
                  width: 60,
                  height: 60,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 15,
                  background: isActive ? 'rgba(108, 92, 231, 0.08)' : 'transparent',
                  transition: 'background 0.15s',
                }}
              >
                <tab.Icon />
              </div>
              <span style={{ fontSize: 18, fontWeight: isActive ? 600 : 400, lineHeight: 1 }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Part B: Content Panel */}
      <div
        style={{
          width: 390,
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {activeTab === 'labels' && <LabelsPanel />}
        {activeTab === 'layers' && <LayersPanel />}
        {activeTab === 'images' && <ImagesPanel />}
        {activeTab === 'review' && <ReviewTabPanel />}
      </div>
    </div>
  );
}
