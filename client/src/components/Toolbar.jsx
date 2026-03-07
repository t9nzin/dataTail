import { useEffect, useState } from 'react';
import { useStore } from '../store';
import * as api from '../api';

const ToolIcon = ({ id }) => {
  const s = { width: 20, height: 20, stroke: 'currentColor', fill: 'none', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (id) {
    case 'select':
      return (
        <svg {...s} viewBox="0 0 24 24">
          <path d="M5 3l3.5 16 3-6.5L18 9z" fill="currentColor" stroke="currentColor" />
        </svg>
      );
    case 'click-segment':
      return (
        <svg {...s} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" fill="currentColor" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
      );
    case 'box-segment':
      return (
        <svg {...s} viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 2" />
        </svg>
      );
    case 'segment-everything':
      return (
        <svg {...s} viewBox="0 0 24 24">
          <circle cx="8" cy="8" r="4" />
          <circle cx="17" cy="9" r="3" />
          <circle cx="11" cy="17" r="4" />
        </svg>
      );
    case 'polygon':
      return (
        <svg {...s} viewBox="0 0 24 24">
          <polygon points="12,3 21,9 18,20 6,20 3,9" />
        </svg>
      );
    case 'bbox':
      return (
        <svg {...s} viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="1" />
        </svg>
      );
    case 'pan':
      return (
        <svg {...s} viewBox="0 0 24 24">
          <path d="M12 2l3 3h-2v4h4v-2l3 3-3 3v-2h-4v4h2l-3 3-3-3h2v-4H7v2l-3-3 3-3v2h4V5H9z" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return null;
  }
};

const tools = [
  { id: 'select', title: 'Select (V)', key: 'v' },
  { id: 'polygon', title: 'Polygon (P)', key: 'p' },
  { id: 'bbox', title: 'Bounding Box (R)', key: 'r' },
  { id: 'click-segment', title: 'Click Segment (C)', key: 'c' },
  { id: 'box-segment', title: 'Box Segment (B)', key: 'b' },
  { id: 'pan', title: 'Pan (Space)', key: ' ' },
];

export default function Toolbar() {
  const activeTool = useStore((s) => s.activeTool);
  const setActiveTool = useStore((s) => s.setActiveTool);
  const labelClasses = useStore((s) => s.labelClasses);
  const activeLabel = useStore((s) => s.activeLabel);
  const setActiveLabel = useStore((s) => s.setActiveLabel);
  const currentProject = useStore((s) => s.currentProject);
  const currentImage = useStore((s) => s.currentImage);
  const setLabelClasses = useStore((s) => s.setLabelClasses);
  const setAiResults = useStore((s) => s.setAiResults);
  const setAiProcessing = useStore((s) => s.setAiProcessing);
  const isAiProcessing = useStore((s) => s.isAiProcessing);

  const [addingLabel, setAddingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#4a9eff');
  const [prevTool, setPrevTool] = useState(null);

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

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        if (!prevTool) {
          setPrevTool(activeTool);
          setActiveTool('pan');
        }
        return;
      }
      if (e.key.toLowerCase() === 'e') {
        handleSegmentEverything();
        return;
      }
      const tool = tools.find((t) => t.key === e.key.toLowerCase());
      if (tool) {
        setActiveTool(tool.id);
      }
    }

    function handleKeyUp(e) {
      if (e.key === ' ' && prevTool) {
        setActiveTool(prevTool);
        setPrevTool(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeTool, prevTool, setActiveTool]);

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

  const defaultColors = ['#4a9eff', '#ff4a4a', '#4aff4a', '#ffff4a', '#ff4aff', '#4affff', '#ff8c00', '#8c00ff'];

  return (
    <div
      style={{
        width: 60,
        background: '#2d2d2d',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 8,
        borderRight: '1px solid #3d3d3d',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {tools.map((tool) => (
        <button
          key={tool.id}
          title={tool.title}
          onClick={() => setActiveTool(tool.id)}
          style={{
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: activeTool === tool.id ? '#4a9eff' : 'transparent',
            color: activeTool === tool.id ? '#fff' : '#b0b0b0',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 18,
            fontWeight: 700,
            fontFamily: 'monospace',
            marginBottom: 4,
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            if (activeTool !== tool.id) {
              e.currentTarget.style.background = '#3d3d3d';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTool !== tool.id) {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <ToolIcon id={tool.id} />
        </button>
      ))}

      <div
        style={{
          width: 36,
          height: 1,
          background: '#555',
          margin: '8px 0',
        }}
      />

      {/* Segment Everything action button */}
      <button
        title="Segment All (E)"
        onClick={handleSegmentEverything}
        disabled={!currentImage || isAiProcessing}
        style={{
          width: 52,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          padding: '8px 4px',
          background: isAiProcessing ? '#ff4aff22' : '#ff4aff11',
          color: !currentImage ? '#555' : isAiProcessing ? '#ff4aff' : '#ff4aff',
          border: '1px solid #ff4aff44',
          borderRadius: 6,
          cursor: !currentImage || isAiProcessing ? 'default' : 'pointer',
          marginBottom: 8,
          transition: 'background 0.15s, border-color 0.15s',
          opacity: !currentImage ? 0.3 : 1,
        }}
        onMouseEnter={(e) => {
          if (currentImage && !isAiProcessing) {
            e.currentTarget.style.background = '#ff4aff33';
            e.currentTarget.style.borderColor = '#ff4aff88';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isAiProcessing ? '#ff4aff22' : '#ff4aff11';
          e.currentTarget.style.borderColor = '#ff4aff44';
        }}
      >
        {isAiProcessing ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 2a10 10 0 0 1 10 10">
              <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
            </path>
          </svg>
        ) : (
          <ToolIcon id="segment-everything" />
        )}
        <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>
          {isAiProcessing ? 'Running' : 'Seg All'}
        </span>
      </button>

      <div
        style={{
          width: 36,
          height: 1,
          background: '#555',
          margin: '0 0 8px 0',
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          padding: '0 4px',
          flex: 1,
          overflow: 'auto',
        }}
      >
        <div
          style={{
            fontSize: 9,
            color: '#888',
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 6,
          }}
        >
          Label
        </div>

        {labelClasses.map((lc) => (
          <button
            key={lc.id}
            title={lc.name}
            onClick={() => setActiveLabel(lc)}
            style={{
              width: 44,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              background: activeLabel?.id === lc.id ? '#3d3d3d' : 'transparent',
              border: activeLabel?.id === lc.id ? '1px solid #4a9eff' : '1px solid transparent',
              borderRadius: 4,
              cursor: 'pointer',
              marginBottom: 2,
              padding: 0,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: lc.color || '#4a9eff',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 9,
                color: '#ccc',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 24,
              }}
            >
              {lc.name}
            </span>
          </button>
        ))}

        {addingLabel ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              marginTop: 4,
              width: '100%',
              padding: '0 2px',
            }}
          >
            <input
              autoFocus
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddLabel();
                if (e.key === 'Escape') setAddingLabel(false);
              }}
              placeholder="name"
              style={{
                width: '100%',
                fontSize: 10,
                padding: '3px 4px',
                background: '#1e1e1e',
                border: '1px solid #555',
                borderRadius: 3,
                color: '#e0e0e0',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
              {defaultColors.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewLabelColor(c)}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 2,
                    background: c,
                    border: newLabelColor === c ? '2px solid #fff' : '1px solid #555',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 2 }}>
              <button
                onClick={handleAddLabel}
                style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  background: '#4a9eff',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 3,
                  cursor: 'pointer',
                }}
              >
                OK
              </button>
              <button
                onClick={() => setAddingLabel(false)}
                style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  background: '#555',
                  color: '#ccc',
                  border: 'none',
                  borderRadius: 3,
                  cursor: 'pointer',
                }}
              >
                X
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingLabel(true)}
            title="Add Label"
            style={{
              width: 44,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              color: '#888',
              border: '1px dashed #555',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 16,
              marginTop: 4,
            }}
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}
