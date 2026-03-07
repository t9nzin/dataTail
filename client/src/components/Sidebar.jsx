import { useState, useRef, useMemo } from 'react';
import { useStore } from '../store';
import * as api from '../api';

// ── Constants ────────────────────────────────────────────────────────────────

const ACCENT = '#6C5CE7';
const ACCENT_BG = 'rgba(108, 92, 231, 0.10)';
const BORDER = '#e5e5e5';
const TEXT_PRIMARY = '#1a1a1a';
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
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
      <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z" />
    </svg>
  );
}

function TrashSmallIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
        fontSize: 10,
        padding: '1px 6px',
        borderRadius: 3,
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
    const lc = labelClasses.find((l) => l.name === labelName);
    return lc?.color || '#888';
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
          label: null,
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
      <div style={{ padding: '16px 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY }}>Annotations</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: ACCENT,
              background: ACCENT_BG,
              padding: '1px 8px',
              borderRadius: 10,
            }}
          >
            {annotations.length}
          </span>
        </div>
        {activeLabel && (
          <div style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 2 }}>
            Group: {activeLabel.name}
          </div>
        )}
      </div>

      {/* Sub-tabs: Classes | Layers */}
      <div
        style={{
          display: 'flex',
          borderBottom: `1px solid ${BORDER}`,
          margin: '0 16px',
        }}
      >
        {['classes', 'layers'].map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            style={{
              flex: 1,
              padding: '8px 0',
              fontSize: 12,
              fontWeight: subTab === tab ? 600 : 400,
              color: subTab === tab ? ACCENT : TEXT_SECONDARY,
              background: 'transparent',
              border: 'none',
              borderBottom: subTab === tab ? `2px solid ${ACCENT}` : '2px solid transparent',
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
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
                    gap: 10,
                    width: '100%',
                    padding: '8px 16px',
                    background: isActive ? ACCENT_BG : 'transparent',
                    border: 'none',
                    borderLeft: isActive ? `3px solid ${ACCENT}` : '3px solid transparent',
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
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: lc.color || '#4a9eff',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 13,
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
                      fontSize: 11,
                      color: TEXT_SECONDARY,
                      background: '#f0f0f0',
                      padding: '1px 6px',
                      borderRadius: 8,
                      fontWeight: 500,
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            {/* Unused classes section */}
            {unusedClasses.length > 0 && (
              <>
                <div
                  style={{
                    fontSize: 11,
                    color: TEXT_MUTED,
                    padding: '12px 16px 6px',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
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
                        gap: 10,
                        width: '100%',
                        padding: '6px 16px',
                        background: isActive ? ACCENT_BG : 'transparent',
                        border: 'none',
                        borderLeft: isActive ? `3px solid ${ACCENT}` : '3px solid transparent',
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
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: lc.color || '#4a9eff',
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 13,
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
                    </button>
                  );
                })}
              </>
            )}

            {labelClasses.length === 0 && (
              <div style={{ padding: '24px 16px', color: TEXT_MUTED, fontSize: 12, textAlign: 'center' }}>
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
      <div style={{ padding: '12px 16px', borderTop: `1px solid ${BORDER}` }}>
        {addingLabel ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                fontSize: 13,
                padding: '6px 10px',
                background: '#fff',
                border: `1px solid ${BORDER}`,
                borderRadius: 6,
                color: TEXT_PRIMARY,
                outline: 'none',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = ACCENT; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = BORDER; }}
            />
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {defaultColors.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewLabelColor(c)}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    background: c,
                    border: newLabelColor === c ? `2px solid ${TEXT_PRIMARY}` : '2px solid transparent',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'border-color 0.1s',
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={handleAddLabel}
                style={{
                  flex: 1,
                  fontSize: 12,
                  padding: '6px 12px',
                  background: ACCENT,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Add
              </button>
              <button
                onClick={() => setAddingLabel(false)}
                style={{
                  fontSize: 12,
                  padding: '6px 12px',
                  background: '#f0f0f0',
                  color: TEXT_SECONDARY,
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => setAddingLabel(true)}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: 13,
                fontWeight: 500,
                background: '#f8f8f8',
                color: TEXT_PRIMARY,
                border: `1px dashed ${BORDER}`,
                borderRadius: 6,
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
                padding: '8px',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                background: 'transparent',
                color: !currentImage ? TEXT_MUTED : ACCENT,
                border: `1.5px solid ${!currentImage ? BORDER : ACCENT}`,
                borderRadius: 6,
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
  const selectedAnnotation = useStore((s) => s.selectedAnnotation);
  const setSelectedAnnotation = useStore((s) => s.setSelectedAnnotation);
  const removeAnnotation = useStore((s) => s.removeAnnotation);
  const labelClasses = useStore((s) => s.labelClasses);

  function getLabelColor(labelName) {
    const lc = labelClasses.find((l) => l.name === labelName);
    return lc?.color || '#888';
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

  if (annotations.length === 0) {
    return (
      <div style={{ padding: '24px 16px', color: TEXT_MUTED, fontSize: 12, textAlign: 'center' }}>
        No annotations yet
      </div>
    );
  }

  return (
    <>
      {annotations.map((ann) => {
        const isSelected = selectedAnnotation?.id === ann.id;
        return (
          <div
            key={ann.id}
            onClick={() => setSelectedAnnotation(ann)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '7px 16px',
              cursor: 'pointer',
              background: isSelected ? ACCENT_BG : 'transparent',
              borderLeft: isSelected ? `3px solid ${ACCENT}` : '3px solid transparent',
              transition: 'background 0.1s',
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
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: getLabelColor(ann.label),
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 13,
                color: isSelected ? ACCENT : TEXT_PRIMARY,
                fontWeight: isSelected ? 600 : 400,
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {ann.label || 'unlabeled'}
            </span>
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
                padding: 2,
                display: 'flex',
                alignItems: 'center',
                borderRadius: 4,
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY }}>Layers</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: ACCENT,
              background: ACCENT_BG,
              padding: '1px 8px',
              borderRadius: 10,
            }}
          >
            {annotations.length}
          </span>
        </div>
        <div style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 2 }}>
          Individual annotations for current image
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
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
      <div style={{ padding: '16px 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY }}>Images</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: ACCENT,
              background: ACCENT_BG,
              padding: '1px 8px',
              borderRadius: 10,
            }}
          >
            {images.length}
          </span>
        </div>
      </div>

      <div style={{ padding: '0 16px 10px' }}>
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
            padding: '8px',
            background: 'transparent',
            border: `1.5px dashed ${ACCENT}`,
            borderRadius: 6,
            color: ACCENT,
            cursor: 'pointer',
            fontSize: 13,
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
          <div style={{ padding: '24px 16px', color: TEXT_MUTED, fontSize: 12, textAlign: 'center' }}>
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
                gap: 10,
                padding: '6px 16px',
                cursor: 'pointer',
                background: isCurrent ? ACCENT_BG : 'transparent',
                borderLeft: isCurrent ? `3px solid ${ACCENT}` : '3px solid transparent',
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
                  width: 40,
                  height: 40,
                  borderRadius: 6,
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
                    fontSize: 13,
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
                  <div style={{ fontSize: 11, color: TEXT_SECONDARY }}>
                    {img.annotation_count} annotation{img.annotation_count !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
              {img.annotation_count != null && img.annotation_count > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    background: ACCENT_BG,
                    color: ACCENT,
                    padding: '1px 8px',
                    borderRadius: 10,
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

function ReviewTabPanel() {
  const currentImage = useStore((s) => s.currentImage);
  const currentProject = useStore((s) => s.currentProject);
  const reviewIssues = useStore((s) => s.reviewIssues);
  const setReviewIssues = useStore((s) => s.setReviewIssues);
  const annotations = useStore((s) => s.annotations);
  const updateAnnotation = useStore((s) => s.updateAnnotation);
  const removeAnnotation = useStore((s) => s.removeAnnotation);
  const setSelectedAnnotation = useStore((s) => s.setSelectedAnnotation);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleRunReview() {
    if (!currentImage) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.qualityReview(currentImage.id, currentProject?.id);
      const issues = result.issues || result || [];
      setReviewIssues(Array.isArray(issues) ? issues : []);
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
    if (issue.annotation_id) {
      const ann = annotations.find((a) => a.id === issue.annotation_id);
      if (ann) setSelectedAnnotation(ann);
    }
  }

  const sortedIssues = [...reviewIssues].sort((a, b) => {
    const order = { error: 0, warning: 1, info: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 16px 12px' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY }}>AI Review</span>
        <div style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 2 }}>
          Check annotation quality with AI
        </div>
      </div>

      <div style={{ padding: '0 16px 12px' }}>
        <button
          onClick={handleRunReview}
          disabled={loading || !currentImage}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: 13,
            fontWeight: 600,
            background: loading ? '#f0f0f0' : ACCENT,
            color: loading ? TEXT_SECONDARY : '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: loading || !currentImage ? 'default' : 'pointer',
            opacity: !currentImage ? 0.5 : 1,
            transition: 'background 0.15s',
          }}
        >
          {loading ? 'Reviewing...' : 'Run Quality Review'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 8px' }}>
        {error && (
          <div
            style={{
              margin: '0 16px 8px',
              padding: '10px 12px',
              background: 'rgba(231,76,60,0.06)',
              border: '1px solid rgba(231,76,60,0.2)',
              borderRadius: 6,
              color: '#e74c3c',
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        {!currentImage && (
          <div style={{ textAlign: 'center', color: TEXT_MUTED, padding: '32px 16px', fontSize: 12 }}>
            Select an image to run quality review
          </div>
        )}

        {currentImage && sortedIssues.length === 0 && !loading && (
          <div style={{ textAlign: 'center', color: TEXT_MUTED, padding: '32px 16px', fontSize: 12 }}>
            {reviewIssues.length === 0
              ? 'Click "Run Quality Review" to check annotations'
              : 'All issues resolved'}
          </div>
        )}

        {loading && sortedIssues.length === 0 && (
          <div style={{ textAlign: 'center', color: TEXT_SECONDARY, padding: '32px 16px', fontSize: 12 }}>
            Analyzing annotations...
          </div>
        )}

        {sortedIssues.map((issue, idx) => {
          const severity = issue.severity || 'info';
          const color = SEVERITY_COLORS[severity] || '#888';
          return (
            <div
              key={idx}
              style={{
                margin: '0 12px 6px',
                padding: '10px 12px',
                background: '#fafafa',
                borderRadius: 8,
                borderLeft: `3px solid ${color}`,
              }}
            >
              <div style={{ fontSize: 12, color: TEXT_PRIMARY, marginBottom: 4, lineHeight: 1.4 }}>
                {issue.message}
              </div>
              {issue.suggestion && (
                <div style={{ fontSize: 11, color: TEXT_SECONDARY, marginBottom: 8 }}>
                  {issue.suggestion}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                {issue.fix && (
                  <button
                    onClick={() => handleAcceptFix(issue, idx)}
                    style={{
                      padding: '4px 10px',
                      background: 'rgba(46,204,113,0.08)',
                      border: '1px solid rgba(46,204,113,0.3)',
                      borderRadius: 4,
                      color: '#27ae60',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 500,
                    }}
                  >
                    Accept Fix
                  </button>
                )}
                <button
                  onClick={() => handleDismiss(idx)}
                  style={{
                    padding: '4px 10px',
                    background: '#f0f0f0',
                    border: '1px solid #e5e5e5',
                    borderRadius: 4,
                    color: TEXT_SECONDARY,
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                >
                  Dismiss
                </button>
                {issue.annotation_id && (
                  <button
                    onClick={() => handleView(issue)}
                    style={{
                      padding: '4px 10px',
                      background: ACCENT_BG,
                      border: `1px solid rgba(108,92,231,0.3)`,
                      borderRadius: 4,
                      color: ACCENT,
                      cursor: 'pointer',
                      fontSize: 11,
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

export default function Sidebar() {
  const [activeTab, setActiveTab] = useState('labels');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        flexShrink: 0,
        height: '100%',
      }}
    >
      {/* Part A: Icon Tab Bar (56px) */}
      <div
        style={{
          width: 56,
          background: '#fafafa',
          borderRight: `1px solid ${BORDER}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 8,
          flexShrink: 0,
          userSelect: 'none',
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              title={tab.label}
              style={{
                width: 56,
                height: 56,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                background: isActive ? '#fff' : 'transparent',
                color: isActive ? ACCENT : TEXT_SECONDARY,
                border: 'none',
                borderLeft: isActive ? `3px solid ${ACCENT}` : '3px solid transparent',
                borderRight: 'none',
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
                padding: 0,
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = '#f0f0f0';
                  e.currentTarget.style.color = '#555';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = TEXT_SECONDARY;
                }
              }}
            >
              <tab.Icon />
              <span style={{ fontSize: 9, fontWeight: isActive ? 600 : 400, lineHeight: 1 }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Part B: Content Panel (280px) */}
      <div
        style={{
          width: 280,
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRight: `1px solid ${BORDER}`,
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
