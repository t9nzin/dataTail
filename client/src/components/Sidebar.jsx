import { useState, useRef } from 'react';
import { useStore } from '../store';
import * as api from '../api';

const panelHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  background: '#2a2a2a',
  cursor: 'pointer',
  userSelect: 'none',
  borderBottom: '1px solid #3d3d3d',
  fontSize: 12,
  fontWeight: 600,
  color: '#ccc',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

function SourceBadge({ source }) {
  const colors = {
    manual: '#4aff4a',
    'sam-click': '#4a9eff',
    'sam-box': '#ff8c00',
    'sam-everything': '#ff4aff',
    'nl-annotate': '#ffff4a',
    ai: '#4a9eff',
  };
  return (
    <span
      style={{
        fontSize: 9,
        padding: '1px 4px',
        borderRadius: 3,
        background: (colors[source] || '#888') + '22',
        color: colors[source] || '#888',
        border: `1px solid ${colors[source] || '#888'}44`,
      }}
    >
      {source || 'manual'}
    </span>
  );
}

function AnnotationsPanel() {
  const annotations = useStore((s) => s.annotations);
  const selectedAnnotation = useStore((s) => s.selectedAnnotation);
  const setSelectedAnnotation = useStore((s) => s.setSelectedAnnotation);
  const removeAnnotation = useStore((s) => s.removeAnnotation);
  const aiResults = useStore((s) => s.aiResults);
  const setAiResults = useStore((s) => s.setAiResults);
  const addAnnotation = useStore((s) => s.addAnnotation);
  const currentImage = useStore((s) => s.currentImage);
  const currentProject = useStore((s) => s.currentProject);
  const labelClasses = useStore((s) => s.labelClasses);
  const [collapsed, setCollapsed] = useState(false);

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

  async function handleAcceptSuggestion(suggestion, idx) {
    if (!currentImage || !currentProject) return;
    try {
      const created = await api.createAnnotation({
        image_id: currentImage.id,
        project_id: currentProject.id,
        label: suggestion.label,
        type: suggestion.type || 'polygon',
        data: suggestion.data,
        source: suggestion.source || 'ai',
      });
      addAnnotation(created);
      const updated = aiResults.filter((_, i) => i !== idx);
      setAiResults(updated);
    } catch (err) {
      console.error('Failed to accept suggestion:', err);
    }
  }

  function handleRejectSuggestion(idx) {
    const updated = aiResults.filter((_, i) => i !== idx);
    setAiResults(updated);
  }

  async function handleAcceptAll() {
    if (!currentImage || !currentProject) return;
    try {
      const batch = aiResults.map((s) => ({
        image_id: currentImage.id,
        project_id: currentProject.id,
        label: s.label,
        type: s.type || 'polygon',
        data: s.data,
        source: s.source || 'sam-auto',
      }));
      const created = await api.createAnnotationsBatch(batch);
      for (const ann of created) addAnnotation(ann);
      setAiResults([]);
    } catch (err) {
      console.error('Failed to accept all suggestions:', err);
    }
  }

  function handleRejectAll() {
    setAiResults([]);
  }

  function getLabelColor(labelName) {
    const lc = labelClasses.find((l) => l.name === labelName);
    return lc?.color || '#888';
  }

  return (
    <div>
      <div style={panelHeaderStyle} onClick={() => setCollapsed(!collapsed)}>
        <span>Annotations ({annotations.length})</span>
        <span style={{ fontSize: 10 }}>{collapsed ? '+' : '-'}</span>
      </div>
      {!collapsed && (
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {annotations.length === 0 && (
            <div style={{ padding: '16px 12px', color: '#666', fontSize: 12, textAlign: 'center' }}>
              No annotations yet
            </div>
          )}
          {annotations.map((ann) => (
            <div
              key={ann.id}
              onClick={() => setSelectedAnnotation(ann)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                cursor: 'pointer',
                background: selectedAnnotation?.id === ann.id ? '#3d3d3d' : 'transparent',
                borderBottom: '1px solid #2a2a2a',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => {
                if (selectedAnnotation?.id !== ann.id) e.currentTarget.style.background = '#333';
              }}
              onMouseLeave={(e) => {
                if (selectedAnnotation?.id !== ann.id) e.currentTarget.style.background = 'transparent';
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: getLabelColor(ann.label),
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 12, color: '#e0e0e0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ann.label || 'unlabeled'}
              </span>
              <span style={{ fontSize: 10, color: '#888' }}>{ann.type}</span>
              <SourceBadge source={ann.source} />
              {ann.confidence != null && (
                <span style={{ fontSize: 9, color: '#888' }}>
                  {Math.round(ann.confidence * 100)}%
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(ann);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#888',
                  cursor: 'pointer',
                  fontSize: 14,
                  padding: '0 2px',
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ff4a4a')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#888')}
              >
                x
              </button>
            </div>
          ))}

          {aiResults.length > 0 && (
            <>
              <div
                style={{
                  padding: '6px 12px',
                  fontSize: 10,
                  color: '#4a9eff',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  borderTop: '1px solid #4a9eff44',
                  background: '#4a9eff11',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>AI Suggestions ({aiResults.length})</span>
                <span style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={handleAcceptAll}
                    style={{
                      background: '#4aff4a33',
                      border: '1px solid #4aff4a66',
                      color: '#4aff4a',
                      cursor: 'pointer',
                      fontSize: 9,
                      padding: '1px 6px',
                      borderRadius: 3,
                    }}
                  >
                    Accept All
                  </button>
                  <button
                    onClick={handleRejectAll}
                    style={{
                      background: '#ff4a4a33',
                      border: '1px solid #ff4a4a66',
                      color: '#ff4a4a',
                      cursor: 'pointer',
                      fontSize: 9,
                      padding: '1px 6px',
                      borderRadius: 3,
                    }}
                  >
                    Reject All
                  </button>
                </span>
              </div>
              {aiResults.map((suggestion, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    background: '#4a9eff08',
                    borderBottom: '1px solid #2a2a2a',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: getLabelColor(suggestion.label),
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 12, color: '#e0e0e0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {suggestion.label || 'unlabeled'}
                  </span>
                  {(suggestion.confidence ?? suggestion.score) != null && (
                    <span style={{ fontSize: 9, color: '#888' }}>
                      {Math.round((suggestion.confidence ?? suggestion.score) * 100)}%
                    </span>
                  )}
                  <button
                    onClick={() => handleAcceptSuggestion(suggestion, idx)}
                    style={{
                      background: '#4aff4a33',
                      border: '1px solid #4aff4a66',
                      color: '#4aff4a',
                      cursor: 'pointer',
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 3,
                    }}
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleRejectSuggestion(idx)}
                    style={{
                      background: '#ff4a4a33',
                      border: '1px solid #ff4a4a66',
                      color: '#ff4a4a',
                      cursor: 'pointer',
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 3,
                    }}
                  >
                    Reject
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PropertiesPanel() {
  const selectedAnnotation = useStore((s) => s.selectedAnnotation);
  const updateAnnotation = useStore((s) => s.updateAnnotation);
  const labelClasses = useStore((s) => s.labelClasses);
  const [collapsed, setCollapsed] = useState(false);

  async function handleLabelChange(newLabel) {
    if (!selectedAnnotation) return;
    try {
      await api.updateAnnotation(selectedAnnotation.id, { label: newLabel });
      updateAnnotation(selectedAnnotation.id, { label: newLabel });
    } catch (err) {
      console.error('Failed to update annotation label:', err);
    }
  }

  if (!selectedAnnotation) {
    return (
      <div>
        <div style={panelHeaderStyle}>
          <span>Properties</span>
        </div>
        <div style={{ padding: '16px 12px', color: '#666', fontSize: 12, textAlign: 'center' }}>
          Select an annotation
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={panelHeaderStyle} onClick={() => setCollapsed(!collapsed)}>
        <span>Properties</span>
        <span style={{ fontSize: 10 }}>{collapsed ? '+' : '-'}</span>
      </div>
      {!collapsed && (
        <div style={{ padding: '8px 12px' }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>Label</div>
            <select
              value={selectedAnnotation.label || ''}
              onChange={(e) => handleLabelChange(e.target.value)}
              style={{
                width: '100%',
                padding: '4px 6px',
                background: '#1e1e1e',
                border: '1px solid #555',
                borderRadius: 4,
                color: '#e0e0e0',
                fontSize: 12,
                outline: 'none',
              }}
            >
              <option value="">-- none --</option>
              {labelClasses.map((lc) => (
                <option key={lc.id} value={lc.name}>
                  {lc.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>Type</div>
            <div style={{ fontSize: 12, color: '#e0e0e0' }}>{selectedAnnotation.type || '-'}</div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>Confidence</div>
            <div style={{ fontSize: 12, color: '#e0e0e0' }}>
              {selectedAnnotation.confidence != null
                ? `${Math.round(selectedAnnotation.confidence * 100)}%`
                : '-'}
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>Source</div>
            <SourceBadge source={selectedAnnotation.source} />
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>Created By</div>
            <div style={{ fontSize: 12, color: '#e0e0e0' }}>{selectedAnnotation.created_by || '-'}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function ImageListPanel() {
  const images = useStore((s) => s.images);
  const currentImage = useStore((s) => s.currentImage);
  const setCurrentImage = useStore((s) => s.setCurrentImage);
  const currentProject = useStore((s) => s.currentProject);
  const setImages = useStore((s) => s.setImages);
  const setAnnotations = useStore((s) => s.setAnnotations);
  const setSelectedAnnotation = useStore((s) => s.setSelectedAnnotation);
  const [collapsed, setCollapsed] = useState(false);
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
      const result = await api.uploadImages(currentProject.id, files);
      const updated = await api.fetchImages(currentProject.id);
      setImages(updated);
    } catch (err) {
      console.error('Failed to upload images:', err);
    }
    e.target.value = '';
  }

  return (
    <div>
      <div style={panelHeaderStyle} onClick={() => setCollapsed(!collapsed)}>
        <span>Images ({images.length})</span>
        <span style={{ fontSize: 10 }}>{collapsed ? '+' : '-'}</span>
      </div>
      {!collapsed && (
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          <div style={{ padding: '6px 12px' }}>
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
                padding: '6px',
                background: '#4a9eff22',
                border: '1px dashed #4a9eff',
                borderRadius: 4,
                color: '#4a9eff',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              + Upload Images
            </button>
          </div>

          {images.length === 0 && (
            <div style={{ padding: '12px', color: '#666', fontSize: 12, textAlign: 'center' }}>
              No images
            </div>
          )}

          {images.map((img) => (
            <div
              key={img.id}
              onClick={() => handleImageClick(img)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                cursor: 'pointer',
                background: currentImage?.id === img.id ? '#3d3d3d' : 'transparent',
                borderBottom: '1px solid #2a2a2a',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => {
                if (currentImage?.id !== img.id) e.currentTarget.style.background = '#333';
              }}
              onMouseLeave={(e) => {
                if (currentImage?.id !== img.id) e.currentTarget.style.background = 'transparent';
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 4,
                  background: '#1e1e1e',
                  overflow: 'hidden',
                  flexShrink: 0,
                  border: currentImage?.id === img.id ? '2px solid #4a9eff' : '2px solid transparent',
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
                    fontSize: 12,
                    color: '#e0e0e0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {img.filename || `Image ${img.id}`}
                </div>
                {img.annotation_count != null && (
                  <div style={{ fontSize: 10, color: '#888' }}>
                    {img.annotation_count} annotation{img.annotation_count !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
              {img.annotation_count != null && img.annotation_count > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    background: '#4a9eff33',
                    color: '#4a9eff',
                    padding: '1px 6px',
                    borderRadius: 8,
                    fontWeight: 600,
                  }}
                >
                  {img.annotation_count}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  return (
    <div
      style={{
        width: 300,
        background: '#252525',
        borderLeft: '1px solid #3d3d3d',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        flexShrink: 0,
      }}
    >
      <AnnotationsPanel />
      <PropertiesPanel />
      <ImageListPanel />
    </div>
  );
}
