import { useEffect, useState, useCallback } from 'react';
import { useStore } from '../store';
import * as api from '../api';

// ── Icon Components ──────────────────────────────────────────────────────────

const iconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function SelectIcon() {
  return (
    <svg {...iconProps}>
      <path d="M5 3l3.5 16 3-6.5L18 9z" fill="currentColor" stroke="currentColor" />
    </svg>
  );
}

function PolygonIcon() {
  return (
    <svg {...iconProps}>
      <polygon points="12,3 21,9 18,20 6,20 3,9" />
    </svg>
  );
}

function BboxIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="3" width="18" height="18" rx="1" />
    </svg>
  );
}

function ClickSegmentIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </svg>
  );
}

function BoxSegmentIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 2" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z" fill="currentColor" stroke="currentColor" strokeWidth="1" />
      <path d="M18 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" fill="currentColor" stroke="currentColor" strokeWidth="0.8" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg {...iconProps}>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 10h10a5 5 0 015 5v0a5 5 0 01-5 5H12" />
      <path d="M7 6l-4 4 4 4" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg {...iconProps}>
      <path d="M21 10H11a5 5 0 00-5 5v0a5 5 0 005 5h1" />
      <path d="M17 6l4 4-4 4" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg {...iconProps}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 2a10 10 0 0 1 10 10">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const ACCENT = '#6C5CE7';
const ACCENT_BG = 'rgba(108, 92, 231, 0.10)';

const toolbarStyle = {
  width: 48,
  background: '#fff',
  borderLeft: '1px solid #e5e5e5',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  paddingTop: 8,
  paddingBottom: 8,
  userSelect: 'none',
  flexShrink: 0,
  zIndex: 10,
};

const dividerStyle = {
  width: 28,
  height: 1,
  background: '#e5e5e5',
  margin: '6px 0',
};

function btnStyle(isActive) {
  return {
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: isActive ? ACCENT_BG : 'transparent',
    color: isActive ? ACCENT : '#666',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    marginBottom: 2,
    transition: 'background 0.15s, color 0.15s',
    padding: 0,
  };
}

// ── Component ────────────────────────────────────────────────────────────────

const drawingTools = [
  { id: 'select', title: 'Select (V)', key: 'v', Icon: SelectIcon },
  { id: 'polygon', title: 'Polygon (P)', key: 'p', Icon: PolygonIcon },
  { id: 'bbox', title: 'Bounding Box (R)', key: 'r', Icon: BboxIcon },
];

const aiTools = [
  { id: 'click-segment', title: 'Click Segment (C)', key: 'c', Icon: ClickSegmentIcon },
  { id: 'box-segment', title: 'Box Segment (B)', key: 'b', Icon: BoxSegmentIcon },
];

export default function Toolbar({ onToggleChat }) {
  const activeTool = useStore((s) => s.activeTool);
  const setActiveTool = useStore((s) => s.setActiveTool);
  const currentImage = useStore((s) => s.currentImage);
  const setAiResults = useStore((s) => s.setAiResults);
  const setAiProcessing = useStore((s) => s.setAiProcessing);
  const isAiProcessing = useStore((s) => s.isAiProcessing);
  const selectedAnnotation = useStore((s) => s.selectedAnnotation);
  const removeAnnotation = useStore((s) => s.removeAnnotation);
  const setSelectedAnnotation = useStore((s) => s.setSelectedAnnotation);

  const [chatOpen, setChatOpen] = useState(false);
  const [prevTool, setPrevTool] = useState(null);

  // ── Segment Everything ─────────────────────────────────────────────────

  const handleSegmentEverything = useCallback(async () => {
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
  }, [currentImage?.id, isAiProcessing, setAiProcessing, setAiResults]);

  // ── Delete selected annotation ─────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    if (!selectedAnnotation) return;
    try {
      await api.deleteAnnotation(selectedAnnotation.id);
      removeAnnotation(selectedAnnotation.id);
      setSelectedAnnotation(null);
    } catch (err) {
      console.error('Failed to delete annotation:', err);
    }
  }, [selectedAnnotation, removeAnnotation, setSelectedAnnotation]);

  // ── Toggle chat ────────────────────────────────────────────────────────

  const handleToggleChat = useCallback(() => {
    const next = !chatOpen;
    setChatOpen(next);
    if (onToggleChat) onToggleChat(next);
  }, [chatOpen, onToggleChat]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
      }

      // Space for temporary pan
      if (e.key === ' ') {
        e.preventDefault();
        if (!prevTool) {
          setPrevTool(activeTool);
          setActiveTool('pan');
        }
        return;
      }

      // E for segment everything
      if (e.key.toLowerCase() === 'e') {
        handleSegmentEverything();
        return;
      }

      // T for chat toggle
      if (e.key.toLowerCase() === 't') {
        handleToggleChat();
        return;
      }

      // Delete / Backspace for delete selected
      if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDelete();
        return;
      }

      // Drawing tools
      const drawTool = drawingTools.find((t) => t.key === e.key.toLowerCase());
      if (drawTool) {
        setActiveTool(drawTool.id);
        return;
      }

      // AI tools
      const aiTool = aiTools.find((t) => t.key === e.key.toLowerCase());
      if (aiTool) {
        setActiveTool(aiTool.id);
        return;
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
  }, [activeTool, prevTool, setActiveTool, handleSegmentEverything, handleToggleChat, handleDelete]);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div style={toolbarStyle}>
      {/* Drawing tools */}
      {drawingTools.map((tool) => (
        <button
          key={tool.id}
          title={tool.title}
          onClick={() => setActiveTool(tool.id)}
          style={btnStyle(activeTool === tool.id)}
          onMouseEnter={(e) => {
            if (activeTool !== tool.id) e.currentTarget.style.background = '#f0f0f0';
          }}
          onMouseLeave={(e) => {
            if (activeTool !== tool.id) e.currentTarget.style.background = 'transparent';
          }}
        >
          <tool.Icon />
        </button>
      ))}

      <div style={dividerStyle} />

      {/* AI tools */}
      {aiTools.map((tool) => (
        <button
          key={tool.id}
          title={tool.title}
          onClick={() => setActiveTool(tool.id)}
          style={btnStyle(activeTool === tool.id)}
          onMouseEnter={(e) => {
            if (activeTool !== tool.id) e.currentTarget.style.background = '#f0f0f0';
          }}
          onMouseLeave={(e) => {
            if (activeTool !== tool.id) e.currentTarget.style.background = 'transparent';
          }}
        >
          <tool.Icon />
        </button>
      ))}

      {/* Segment Everything - special action button */}
      <button
        title="Segment Everything (E)"
        onClick={handleSegmentEverything}
        disabled={!currentImage || isAiProcessing}
        style={{
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isAiProcessing ? ACCENT_BG : 'transparent',
          color: !currentImage ? '#ccc' : ACCENT,
          border: `1.5px solid ${!currentImage ? '#e5e5e5' : ACCENT}`,
          borderRadius: 8,
          cursor: !currentImage || isAiProcessing ? 'default' : 'pointer',
          marginBottom: 2,
          padding: 0,
          transition: 'background 0.15s, border-color 0.15s',
          opacity: !currentImage ? 0.4 : 1,
        }}
        onMouseEnter={(e) => {
          if (currentImage && !isAiProcessing) {
            e.currentTarget.style.background = ACCENT_BG;
          }
        }}
        onMouseLeave={(e) => {
          if (!isAiProcessing) {
            e.currentTarget.style.background = 'transparent';
          }
        }}
      >
        {isAiProcessing ? <SpinnerIcon /> : <SparkleIcon />}
      </button>

      <div style={dividerStyle} />

      {/* Chat toggle */}
      <button
        title="Chat / NL Annotate (T)"
        onClick={handleToggleChat}
        style={btnStyle(chatOpen)}
        onMouseEnter={(e) => {
          if (!chatOpen) e.currentTarget.style.background = '#f0f0f0';
        }}
        onMouseLeave={(e) => {
          if (!chatOpen) e.currentTarget.style.background = 'transparent';
        }}
      >
        <ChatIcon />
      </button>

      {/* Undo */}
      <button
        title="Undo"
        onClick={() => {/* undo not yet implemented */}}
        style={btnStyle(false)}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f0f0'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <UndoIcon />
      </button>

      {/* Redo */}
      <button
        title="Redo"
        onClick={() => {/* redo not yet implemented */}}
        style={btnStyle(false)}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f0f0'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <RedoIcon />
      </button>

      <div style={dividerStyle} />

      {/* Delete */}
      <button
        title="Delete Selected (Del)"
        onClick={handleDelete}
        disabled={!selectedAnnotation}
        style={{
          ...btnStyle(false),
          color: selectedAnnotation ? '#e74c3c' : '#ccc',
          opacity: selectedAnnotation ? 1 : 0.4,
          cursor: selectedAnnotation ? 'pointer' : 'default',
        }}
        onMouseEnter={(e) => {
          if (selectedAnnotation) e.currentTarget.style.background = 'rgba(231, 76, 60, 0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <DeleteIcon />
      </button>
    </div>
  );
}
