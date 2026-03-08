import { useState } from 'react';
import { useStore } from '../store';
import * as api from '../api';

const SEVERITY_COLORS = {
  error: '#ff4a4a',
  warning: '#ffff4a',
  info: '#4a9eff',
};

const SEVERITY_LABELS = {
  error: '!!',
  warning: '!',
  info: 'i',
};

export default function ReviewPanel({ isOpen, onClose }) {
  const currentProject = useStore((s) => s.currentProject);
  const images = useStore((s) => s.images);
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

  async function handleRunReview() {
    if (!currentProject) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.qualityReview(currentProject.id);
      const issues = result.issues || result || [];
      setReviewIssues(Array.isArray(issues) ? issues : []);
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
    const updated = reviewIssues.filter((_, i) => i !== idx);
    setReviewIssues(updated);
  }

  function handleDismiss(idx) {
    const updated = reviewIssues.filter((_, i) => i !== idx);
    setReviewIssues(updated);
  }

  function handleView(issue) {
    if (issue.image_id) {
      const img = images.find((i) => i.id === issue.image_id);
      if (img) setCurrentImage(img);
    }
    if (issue.annotation_id) {
      setTimeout(() => {
        const ann = useStore.getState().annotations.find((a) => a.id === issue.annotation_id);
        if (ann) setSelectedAnnotation(ann);
      }, 100);
    }
    if (issue.bbox && !issue.annotation_id) {
      setTimeout(() => {
        setHighlightRegion({
          x1: issue.bbox[0], y1: issue.bbox[1],
          x2: issue.bbox[2], y2: issue.bbox[3],
          label: issue.predicted_label || 'Unknown',
        });
      }, 100);
    }
    onClose();
  }

  if (!isOpen) return null;

  const sortedIssues = [...reviewIssues].sort((a, b) => {
    const order = { error: 0, warning: 1, info: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 560,
          maxHeight: '80vh',
          background: '#1e1e1e',
          borderRadius: 12,
          border: '1px solid #3d3d3d',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #3d3d3d',
            background: '#252525',
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 700, color: '#e0e0e0' }}>
            Quality Review
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={handleRunReview}
              disabled={loading || !currentProject}
              style={{
                padding: '6px 14px',
                background: loading ? '#3d3d3d' : '#4a9eff',
                color: loading ? '#888' : '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: loading || !currentProject ? 'default' : 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {loading ? 'Reviewing...' : 'Run Review'}
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                fontSize: 20,
                padding: '0 4px',
                lineHeight: 1,
              }}
            >
              x
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {error && (
            <div
              style={{
                padding: '12px 16px',
                background: '#ff4a4a22',
                border: '1px solid #ff4a4a44',
                borderRadius: 6,
                color: '#ff4a4a',
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              {error}
            </div>
          )}

          {!currentProject && (
            <div style={{ textAlign: 'center', color: '#666', padding: 40, fontSize: 13 }}>
              Select a project to run quality review
            </div>
          )}

          {reviewHasRun && reviewIssues.length === 0 && sortedIssues.length === 0 && !loading && (
            <div
              style={{
                padding: '16px',
                background: '#4aff4a15',
                border: '1px solid #4aff4a44',
                borderRadius: 6,
                color: '#4aff4a',
                fontSize: 14,
                textAlign: 'center',
                fontWeight: 600,
              }}
            >
              All annotations look good!
            </div>
          )}

          {currentProject && !reviewHasRun && sortedIssues.length === 0 && !loading && (
            <div style={{ textAlign: 'center', color: '#666', padding: 40, fontSize: 13 }}>
              Click "Run Review" to check annotation quality
            </div>
          )}

          {loading && sortedIssues.length === 0 && (
            <div style={{ textAlign: 'center', color: '#888', padding: 40, fontSize: 13 }}>
              Analyzing all images...
            </div>
          )}

          {sortedIssues.map((issue, idx) => {
            const severity = issue.severity || 'info';
            const color = SEVERITY_COLORS[severity] || '#888';
            const isClickable = issue.annotation_id || issue.bbox;
            return (
              <div
                key={idx}
                onClick={() => isClickable && handleView(issue)}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: '12px 16px',
                  background: '#252525',
                  borderRadius: 8,
                  border: `1px solid ${color}33`,
                  marginBottom: 8,
                  cursor: isClickable ? 'pointer' : 'default',
                }}
              >
                {/* Severity icon */}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: `${color}22`,
                    border: `1px solid ${color}66`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: color,
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {SEVERITY_LABELS[severity] || '?'}
                </div>

                {/* Content */}
                <div style={{ flex: 1 }}>
                  {issue.image_filename && (
                    <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>
                      {issue.image_filename}
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: '#e0e0e0', marginBottom: 4 }}>
                    {issue.message}
                  </div>
                  {issue.suggestion && (
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
                      Suggestion: {issue.suggestion}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6 }}>
                    {issue.fix && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAcceptFix(issue, idx); }}
                        style={{
                          padding: '3px 10px',
                          background: '#4aff4a22',
                          border: '1px solid #4aff4a66',
                          borderRadius: 4,
                          color: '#4aff4a',
                          cursor: 'pointer',
                          fontSize: 11,
                        }}
                      >
                        Accept Fix
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDismiss(idx); }}
                      style={{
                        padding: '3px 10px',
                        background: '#55555522',
                        border: '1px solid #55555566',
                        borderRadius: 4,
                        color: '#888',
                        cursor: 'pointer',
                        fontSize: 11,
                      }}
                    >
                      Dismiss
                    </button>
                    {isClickable && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleView(issue); }}
                        style={{
                          padding: '3px 10px',
                          background: '#4a9eff22',
                          border: '1px solid #4a9eff66',
                          borderRadius: 4,
                          color: '#4a9eff',
                          cursor: 'pointer',
                          fontSize: 11,
                        }}
                      >
                        View
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
