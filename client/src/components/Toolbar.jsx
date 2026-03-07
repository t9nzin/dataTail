import { useEffect, useState, useCallback, useRef } from 'react';
import { useStore } from '../store';
import * as api from '../api';

// ── Icon Components ──────────────────────────────────────────────────────────

const iconProps = {
  width: 33,
  height: 33,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
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
      <circle cx="12" cy="12" r="9" />
      <line x1="8" y1="8" x2="16" y2="16" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="33" height="33" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 2a10 10 0 0 1 10 10">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

// ── Tooltip metadata ─────────────────────────────────────────────────────────

const TOOL_INFO = {
  'select': {
    name: 'Select Tool',
    shortcut: 'V',
    description: 'Pan the image or select / reposition annotations.',
    color: '#6C5CE7',
  },
  'polygon': {
    name: 'Polygon Tool',
    shortcut: 'P',
    description: 'Draw polygon annotations by clicking vertices. Close by clicking the first point.',
    color: '#00b894',
  },
  'bbox': {
    name: 'Bounding Box',
    shortcut: 'R',
    description: 'Click and drag to draw rectangular bounding box annotations.',
    color: '#0984e3',
  },
  'click-segment': {
    name: 'Click Segment',
    shortcut: 'C',
    description: 'Click on an object to segment it with AI. Right-click to add negative points.',
    color: '#e17055',
  },
  'box-segment': {
    name: 'Box Segment',
    shortcut: 'B',
    description: 'Draw a box around an object and AI will generate a precise segmentation mask.',
    color: '#fdcb6e',
  },
  '__segment_everything': {
    name: 'Segment Everything',
    shortcut: 'E',
    description: 'Automatically detect and segment all objects in the image using MobileSAM.',
    color: '#a29bfe',
  },
  '__chat': {
    name: 'Chat / NL Annotate',
    shortcut: 'T',
    description: 'Use natural language to describe what to annotate. AI will find and label objects.',
    color: '#55efc4',
  },
  '__undo': {
    name: 'Undo',
    shortcut: null,
    description: 'Undo the last annotation action.',
    color: '#74b9ff',
  },
  '__redo': {
    name: 'Redo',
    shortcut: null,
    description: 'Redo the previously undone action.',
    color: '#74b9ff',
  },
  '__delete': {
    name: 'Delete',
    shortcut: 'Del',
    description: 'Delete the currently selected annotation.',
    color: '#ff7675',
  },
};

// ── Styles ───────────────────────────────────────────────────────────────────

const ACCENT = '#6C5CE7';

// ── Tooltip Card ─────────────────────────────────────────────────────────────

function ToolTooltip({ toolId, btnRect, containerRect }) {
  const info = TOOL_INFO[toolId];
  if (!info) return null;

  // Position the tooltip to the left of the button, vertically centered
  const top = btnRect.top - containerRect.top + btnRect.height / 2;

  return (
    <div
      style={{
        position: 'absolute',
        right: '100%',
        top: top,
        transform: 'translateY(-50%)',
        marginRight: 18,
        width: 360,
        background: '#fff',
        borderRadius: 18,
        boxShadow: '0 6px 36px rgba(0,0,0,0.14), 0 2px 6px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 100,
        animation: 'tooltipFadeIn 0.15s ease-out',
      }}
    >
      {/* Placeholder image */}
      <div
        style={{
          width: '100%',
          height: 180,
          background: `linear-gradient(135deg, ${info.color}22, ${info.color}44)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 18,
            background: info.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: `0 3px 12px ${info.color}55`,
          }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
      </div>

      {/* Text content */}
      <div style={{ padding: '18px 21px 21px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 9 }}>
          <span style={{ fontSize: 21, fontWeight: 700, color: '#1a1a1a' }}>
            {info.name}
          </span>
          {info.shortcut && (
            <span
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: '#555',
                background: '#f0f0f0',
                border: '1px solid #e0e0e0',
                borderRadius: 6,
                padding: '2px 9px',
                lineHeight: '24px',
                fontFamily: 'monospace',
              }}
            >
              {info.shortcut}
            </span>
          )}
        </div>
        <div style={{ fontSize: 18, color: '#666', lineHeight: 1.45 }}>
          {info.description}
        </div>
      </div>
    </div>
  );
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

export default function Toolbar({ uiScale = 1, onToggleChat, chatOpen: chatOpenProp = false }) {
  const activeTool = useStore((s) => s.activeTool);
  const setActiveTool = useStore((s) => s.setActiveTool);
  const currentImage = useStore((s) => s.currentImage);
  const setAiResults = useStore((s) => s.setAiResults);
  const setAiProcessing = useStore((s) => s.setAiProcessing);
  const isAiProcessing = useStore((s) => s.isAiProcessing);
  const selectedAnnotation = useStore((s) => s.selectedAnnotation);
  const removeAnnotation = useStore((s) => s.removeAnnotation);
  const setSelectedAnnotation = useStore((s) => s.setSelectedAnnotation);

  const chatOpen = chatOpenProp;
  const [prevTool, setPrevTool] = useState(null);
  const [hoveredTool, setHoveredTool] = useState(null);
  const [hoveredRect, setHoveredRect] = useState(null);
  const hoverTimerRef = useRef(null);
  const containerRef = useRef(null);

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
    if (onToggleChat) onToggleChat();
  }, [onToggleChat]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────

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

      if (e.key.toLowerCase() === 'e') { handleSegmentEverything(); return; }
      if (e.key.toLowerCase() === 't') { handleToggleChat(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { handleDelete(); return; }

      const drawTool = drawingTools.find((t) => t.key === e.key.toLowerCase());
      if (drawTool) { setActiveTool(drawTool.id); return; }

      const aiTool = aiTools.find((t) => t.key === e.key.toLowerCase());
      if (aiTool) { setActiveTool(aiTool.id); return; }
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

  // ── Hover handlers ─────────────────────────────────────────────────────

  const handleBtnMouseEnter = useCallback((toolId, e) => {
    clearTimeout(hoverTimerRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    hoverTimerRef.current = setTimeout(() => {
      setHoveredRect(rect);
      setHoveredTool(toolId);
    }, 400);
  }, []);

  const handleBtnMouseLeave = useCallback(() => {
    clearTimeout(hoverTimerRef.current);
    setHoveredTool(null);
    setHoveredRect(null);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearTimeout(hoverTimerRef.current);
  }, []);

  // ── Button renderer ───────────────────────────────────────────────────

  function ToolButton({ id, title, Icon, onClick, isActive, disabled, style: extraStyle }) {
    const active = isActive ?? (activeTool === id);
    return (
      <button
        onClick={onClick ?? (() => setActiveTool(id))}
        disabled={disabled}
        onMouseEnter={(e) => {
          handleBtnMouseEnter(id, e);
          if (!active && !disabled) {
            e.currentTarget.style.background = '#f0f0f0';
            e.currentTarget.style.color = '#333';
          }
        }}
        onMouseLeave={(e) => {
          handleBtnMouseLeave();
          if (!active && !disabled) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#555';
          }
        }}
        style={{
          width: 63,
          height: 63,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: active ? ACCENT : 'transparent',
          color: active ? '#fff' : '#555',
          border: 'none',
          borderRadius: 15,
          cursor: disabled ? 'default' : 'pointer',
          padding: 0,
          transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
          boxShadow: active ? '0 3px 12px rgba(108, 92, 231, 0.35)' : 'none',
          opacity: disabled ? 0.35 : 1,
          ...extraStyle,
        }}
      >
        <Icon />
      </button>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  const divider = (
    <div
      style={{
        width: 39,
        height: 2,
        background: '#e5e5e5',
        margin: '6px auto',
        flexShrink: 0,
      }}
    />
  );

  return (
    <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', zIndex: 10, pointerEvents: 'none' }}>
      {/* Inject tooltip fade-in animation */}
      <style>{`
        @keyframes tooltipFadeIn {
          from { opacity: 0; transform: translateY(-50%) translateX(6px); }
          to   { opacity: 1; transform: translateY(-50%) translateX(0); }
        }
      `}</style>

      <div
        ref={containerRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: 81,
          background: '#fff',
          borderRadius: 24,
          boxShadow: '0 3px 24px rgba(0,0,0,0.10)',
          padding: '9px',
          userSelect: 'none',
          flexShrink: 0,
          zIndex: 10,
          marginRight: 18,
          gap: 3,
          position: 'relative',
          pointerEvents: 'auto',
          zoom: uiScale,
        }}
      >
        {/* Tooltip */}
        {hoveredTool && hoveredRect && containerRef.current && (
          <ToolTooltip
            toolId={hoveredTool}
            btnRect={hoveredRect}
            containerRect={containerRef.current.getBoundingClientRect()}
          />
        )}

        {/* Drawing tools */}
        {drawingTools.map((tool) => (
          <ToolButton key={tool.id} id={tool.id} title={tool.title} Icon={tool.Icon} />
        ))}

        {divider}

        {/* AI tools */}
        {aiTools.map((tool) => (
          <ToolButton key={tool.id} id={tool.id} title={tool.title} Icon={tool.Icon} />
        ))}

        {/* Segment Everything */}
        <ToolButton
          id="__segment_everything"
          title="Segment Everything (E)"
          Icon={isAiProcessing ? SpinnerIcon : SparkleIcon}
          onClick={handleSegmentEverything}
          isActive={false}
          disabled={!currentImage || isAiProcessing}
        />

        {divider}

        {/* Chat toggle */}
        <ToolButton
          id="__chat"
          title="Chat / NL Annotate (T)"
          Icon={ChatIcon}
          onClick={handleToggleChat}
          isActive={chatOpen}
        />

        {/* Undo */}
        <ToolButton
          id="__undo"
          title="Undo"
          Icon={UndoIcon}
          onClick={() => {/* undo not yet implemented */}}
          isActive={false}
        />

        {/* Redo */}
        <ToolButton
          id="__redo"
          title="Redo"
          Icon={RedoIcon}
          onClick={() => {/* redo not yet implemented */}}
          isActive={false}
        />

        {divider}

        {/* Delete */}
        <ToolButton
          id="__delete"
          title="Delete Selected (Del)"
          Icon={DeleteIcon}
          onClick={handleDelete}
          isActive={false}
          disabled={!selectedAnnotation}
          style={{
            color: selectedAnnotation ? '#555' : '#ccc',
          }}
        />
      </div>
    </div>
  );
}
