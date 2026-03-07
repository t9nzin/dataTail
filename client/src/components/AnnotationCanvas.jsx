import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useStore } from '../store';
import * as api from '../api';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 40;
const ZOOM_FACTOR = 1.1;
const HANDLE_SIZE = 6; // half-size of selection corner handles (px)
const CURSOR_BROADCAST_INTERVAL = 50; // ms
const POINT_RADIUS = 5; // click-segment point indicator radius
const DEFAULT_ANNOTATION_COLOR = '#45B7D1';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse annotation data — may be a JSON string or already an object. */
function parseData(data) {
  if (!data) return null;
  if (typeof data === 'string') {
    try { return JSON.parse(data); } catch { return null; }
  }
  return data;
}

/** Convert a hex color like '#FF6B6B' to an rgba string. */
function hexToRgba(hex, alpha = 1) {
  if (!hex) return `rgba(69, 183, 209, ${alpha})`;
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Get color for a label by looking it up in labelClasses. */
function labelColor(label, labelClasses) {
  if (!label) return DEFAULT_ANNOTATION_COLOR;
  const cls = labelClasses.find(
    (c) => c.name === label || c.id === label
  );
  return cls?.color || DEFAULT_ANNOTATION_COLOR;
}

/** Point-in-polygon (ray casting). Points is [[x,y], ...]. */
function pointInPolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Point-in-bbox check. box = { x1, y1, x2, y2 } or [x1,y1,x2,y2]. */
function pointInBbox(px, py, box) {
  const x1 = box.x1 ?? box[0];
  const y1 = box.y1 ?? box[1];
  const x2 = box.x2 ?? box[2];
  const y2 = box.y2 ?? box[3];
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  return px >= minX && px <= maxX && py >= minY && py <= maxY;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AnnotationCanvas({ onAnnotationCreated, annotationsVisible = true }) {
  // Refs
  const containerRef = useRef(null);
  const canvasRef = useRef(null);     // bottom: image layer
  const overlayRef = useRef(null);    // top: annotations + interaction
  const imageRef = useRef(null);      // loaded HTMLImageElement
  const rafRef = useRef(null);
  const lastCursorBroadcast = useRef(0);

  // Interaction state (not in store — local to this component)
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Drag state refs (refs to avoid re-renders during drag)
  const isDragging = useRef(false);
  const isPanning = useRef(false);
  const isSpaceDown = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });        // canvas coords at drag start
  const dragStartPan = useRef({ x: 0, y: 0 });      // pan at drag start
  const dragAnnotationOrigin = useRef(null);          // image coords of annotation at start
  const boxDrawing = useRef(null);                     // { x1, y1, x2, y2 } in image coords

  // Click-segment accumulated points
  const [segPoints, setSegPoints] = useState([]);     // [{ x, y, label }]  label: 1=fg, 0=bg

  // Polygon tool state
  const [polyPoints, setPolyPoints] = useState([]);   // [{ x, y }] in image coords
  const polyMousePos = useRef(null);                   // current mouse pos in image coords (for preview)

  // Store bindings
  const currentImage = useStore((s) => s.currentImage);
  const annotations = useStore((s) => s.annotations);
  const selectedAnnotation = useStore((s) => s.selectedAnnotation);
  const activeTool = useStore((s) => s.activeTool);
  const activeLabel = useStore((s) => s.activeLabel);
  const zoom = useStore((s) => s.zoom);
  const pan = useStore((s) => s.pan);
  const aiResults = useStore((s) => s.aiResults);
  const cursors = useStore((s) => s.cursors);
  const currentUser = useStore((s) => s.currentUser);
  const labelClasses = useStore((s) => s.labelClasses);

  const setZoom = useStore((s) => s.setZoom);
  const setPan = useStore((s) => s.setPan);
  const setSelectedAnnotation = useStore((s) => s.setSelectedAnnotation);
  const addAnnotation = useStore((s) => s.addAnnotation);
  const updateAnnotation = useStore((s) => s.updateAnnotation);
  const setAiProcessing = useStore((s) => s.setAiProcessing);
  const setAiResults = useStore((s) => s.setAiResults);

  // -----------------------------------------------------------------------
  // Coordinate transforms
  // -----------------------------------------------------------------------
  const canvasToImage = useCallback(
    (cx, cy) => ({
      x: (cx - pan.x) / zoom,
      y: (cy - pan.y) / zoom,
    }),
    [zoom, pan]
  );

  const imageToCanvas = useCallback(
    (ix, iy) => ({
      x: ix * zoom + pan.x,
      y: iy * zoom + pan.y,
    }),
    [zoom, pan]
  );

  // -----------------------------------------------------------------------
  // Image loading
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!currentImage) {
      imageRef.current = null;
      return;
    }

    setIsImageLoading(true);
    setSegPoints([]);
    boxDrawing.current = null;

    const img = new Image();
    // Image URL: served statically via /uploads/<project_id>/<filename>
    const src =
      currentImage.url ||
      `/uploads/${currentImage.project_id}/${currentImage.filename}`;
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      setIsImageLoading(false);
      // Fit image to canvas
      fitImageToCanvas(img);
    };
    img.onerror = () => {
      imageRef.current = null;
      setIsImageLoading(false);
    };
    img.src = src;
  }, [currentImage?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fitImageToCanvas = useCallback(
    (img) => {
      const container = containerRef.current;
      if (!container || !img) return;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      if (!iw || !ih) return;
      const scale = Math.min(cw / iw, ch / ih, 1) * 0.95; // 95% to leave small margin
      const offsetX = (cw - iw * scale) / 2;
      const offsetY = (ch - ih * scale) / 2;
      setZoom(scale);
      setPan({ x: offsetX, y: offsetY });
    },
    [setZoom, setPan]
  );

  // -----------------------------------------------------------------------
  // Resize handling
  // -----------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(() => {
      const cv = canvasRef.current;
      const ov = overlayRef.current;
      if (cv && ov) {
        const w = container.clientWidth;
        const h = container.clientHeight;
        cv.width = w;
        cv.height = h;
        ov.width = w;
        ov.height = h;
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // -----------------------------------------------------------------------
  // Render loop
  // -----------------------------------------------------------------------
  const render = useCallback(() => {
    const cv = canvasRef.current;
    const ov = overlayRef.current;
    if (!cv || !ov) return;
    const ctx = cv.getContext('2d');
    const octx = ov.getContext('2d');
    const w = cv.width;
    const h = cv.height;

    // --- Image layer ---
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(0, 0, w, h);

    const img = imageRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);
      ctx.imageSmoothingEnabled = zoom < 4;
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    }

    // --- Overlay layer ---
    octx.clearRect(0, 0, w, h);

    // Draw annotations (skip if annotationsVisible is false)
    if (annotationsVisible) {
      for (const ann of annotations) {
        const isSelected =
          selectedAnnotation && selectedAnnotation.id === ann.id;
        const color = labelColor(ann.label, labelClasses);
        const data = parseData(ann.data);
        if (!data) continue;

        if (ann.type === 'polygon') {
          drawPolygon(octx, data, color, isSelected);
        } else if (ann.type === 'bbox') {
          drawBbox(octx, data, color, ann.label, isSelected);
        }
      }

      // Draw AI suggestion results (pending)
      for (const result of aiResults) {
        const data = parseData(result.data || result.polygon || result);
        if (!data) continue;
        const color = result.label
          ? labelColor(result.label, labelClasses)
          : '#6C5CE7';
        drawAiSuggestion(octx, data, color, result);
      }
    }

    // Draw box-segment in-progress rectangle
    if (boxDrawing.current) {
      const b = boxDrawing.current;
      const tl = imageToCanvas(b.x1, b.y1);
      const br = imageToCanvas(b.x2, b.y2);
      octx.save();
      octx.strokeStyle = '#6C5CE7';
      octx.lineWidth = 2;
      octx.setLineDash([6, 3]);
      octx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      octx.setLineDash([]);
      octx.restore();
    }

    // Draw click-segment points
    if (segPoints.length > 0) {
      for (const pt of segPoints) {
        const cp = imageToCanvas(pt.x, pt.y);
        octx.beginPath();
        octx.arc(cp.x, cp.y, POINT_RADIUS, 0, Math.PI * 2);
        octx.fillStyle = pt.label === 1 ? '#6C5CE7' : '#e74c3c';
        octx.fill();
        octx.strokeStyle = '#ffffff';
        octx.lineWidth = 1.5;
        octx.stroke();
      }
    }

    // Draw in-progress polygon
    if (polyPoints.length > 0) {
      octx.save();
      octx.strokeStyle = '#6C5CE7';
      octx.lineWidth = 1.5;
      octx.setLineDash([5, 3]);
      octx.beginPath();
      const firstPt = imageToCanvas(polyPoints[0].x, polyPoints[0].y);
      octx.moveTo(firstPt.x, firstPt.y);
      for (let i = 1; i < polyPoints.length; i++) {
        const cp = imageToCanvas(polyPoints[i].x, polyPoints[i].y);
        octx.lineTo(cp.x, cp.y);
      }
      // Preview line to current mouse position
      if (polyMousePos.current) {
        const mp = imageToCanvas(polyMousePos.current.x, polyMousePos.current.y);
        octx.lineTo(mp.x, mp.y);
      }
      octx.stroke();
      octx.setLineDash([]);
      // Draw vertex dots
      for (let i = 0; i < polyPoints.length; i++) {
        const cp = imageToCanvas(polyPoints[i].x, polyPoints[i].y);
        octx.beginPath();
        octx.arc(cp.x, cp.y, i === 0 ? 6 : 4, 0, Math.PI * 2);
        // First point gets a bigger green ring to indicate "close here"
        octx.fillStyle = i === 0 ? '#6C5CE7' : '#ffffff';
        octx.fill();
        octx.strokeStyle = '#333';
        octx.lineWidth = 1;
        octx.stroke();
      }
      octx.restore();
    }

    // Draw other users' cursors
    for (const [user, pos] of Object.entries(cursors)) {
      if (user === currentUser) continue;
      if (!pos || pos.x == null || pos.y == null) continue;
      const cp = imageToCanvas(pos.x, pos.y);
      octx.save();
      octx.beginPath();
      octx.arc(cp.x, cp.y, 5, 0, Math.PI * 2);
      octx.fillStyle = stringToColor(user);
      octx.fill();
      octx.strokeStyle = '#ffffff';
      octx.lineWidth = 1;
      octx.stroke();
      // Username label
      octx.font = '11px sans-serif';
      octx.fillStyle = '#ffffff';
      octx.shadowColor = '#000000';
      octx.shadowBlur = 3;
      octx.fillText(user, cp.x + 8, cp.y - 4);
      octx.restore();
    }

    // Loading spinner
    if (isAiLoading) {
      drawSpinner(octx, w, h);
    }

    rafRef.current = requestAnimationFrame(render);
  }, [
    annotations,
    selectedAnnotation,
    aiResults,
    zoom,
    pan,
    cursors,
    currentUser,
    labelClasses,
    segPoints,
    polyPoints,
    isAiLoading,
    imageToCanvas,
  ]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(render);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [render]);

  // -----------------------------------------------------------------------
  // Drawing helpers
  // -----------------------------------------------------------------------

  /** Draw a polygon annotation. data = [[x,y], [x,y], ...] (image coords). */
  function drawPolygon(ctx, data, color, isSelected) {
    // data can be [[x,y],...] or [[[x,y],...]] (list of contours)
    const contours = Array.isArray(data[0]?.[0]) ? data : [data];

    for (const contour of contours) {
      if (!contour || contour.length < 2) continue;
      ctx.beginPath();
      const first = imageToCanvas(contour[0][0], contour[0][1]);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < contour.length; i++) {
        const p = imageToCanvas(contour[i][0], contour[i][1]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fillStyle = hexToRgba(color, 0.25);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 3 : 1.5;
      ctx.stroke();
    }

    // Selection handles
    if (isSelected && contours[0]) {
      drawSelectionHandles(ctx, contours[0], color);
    }
  }

  /** Draw a bounding box annotation. data = { x1, y1, x2, y2 }. */
  function drawBbox(ctx, data, color, label, isSelected) {
    const tl = imageToCanvas(data.x1, data.y1);
    const br = imageToCanvas(data.x2, data.y2);
    const w = br.x - tl.x;
    const h = br.y - tl.y;

    ctx.strokeStyle = color;
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.strokeRect(tl.x, tl.y, w, h);

    // Label text
    if (label) {
      ctx.save();
      ctx.font = 'bold 12px sans-serif';
      const textW = ctx.measureText(label).width + 8;
      const textH = 18;
      ctx.fillStyle = color;
      ctx.fillRect(tl.x, tl.y - textH, textW, textH);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, tl.x + 4, tl.y - 5);
      ctx.restore();
    }

    // Selection handles on corners
    if (isSelected) {
      const corners = [
        { x: tl.x, y: tl.y },
        { x: br.x, y: tl.y },
        { x: br.x, y: br.y },
        { x: tl.x, y: br.y },
      ];
      for (const c of corners) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(
          c.x - HANDLE_SIZE,
          c.y - HANDLE_SIZE,
          HANDLE_SIZE * 2,
          HANDLE_SIZE * 2
        );
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(
          c.x - HANDLE_SIZE,
          c.y - HANDLE_SIZE,
          HANDLE_SIZE * 2,
          HANDLE_SIZE * 2
        );
      }
    }
  }

  /** Draw selection handles for polygon vertices. */
  function drawSelectionHandles(ctx, contour, color) {
    // Draw handles at bounding box corners of the polygon
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [px, py] of contour) {
      const cp = imageToCanvas(px, py);
      if (cp.x < minX) minX = cp.x;
      if (cp.y < minY) minY = cp.y;
      if (cp.x > maxX) maxX = cp.x;
      if (cp.y > maxY) maxY = cp.y;
    }
    const corners = [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ];
    for (const c of corners) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(
        c.x - HANDLE_SIZE,
        c.y - HANDLE_SIZE,
        HANDLE_SIZE * 2,
        HANDLE_SIZE * 2
      );
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(
        c.x - HANDLE_SIZE,
        c.y - HANDLE_SIZE,
        HANDLE_SIZE * 2,
        HANDLE_SIZE * 2
      );
    }
  }

  /** Draw AI suggestion with dashed outline and accept/reject buttons. */
  function drawAiSuggestion(ctx, data, color, result) {
    // data can be polygon or bbox
    const isPolygon = Array.isArray(data);
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    if (isPolygon) {
      const contours = Array.isArray(data[0]?.[0]) ? data : [data];
      for (const contour of contours) {
        if (!contour || contour.length < 2) continue;
        ctx.beginPath();
        const first = imageToCanvas(contour[0][0], contour[0][1]);
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < contour.length; i++) {
          const p = imageToCanvas(contour[i][0], contour[i][1]);
          ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.fillStyle = hexToRgba(color, 0.15);
        ctx.fill();
        ctx.stroke();
      }
    } else if (data.x1 != null) {
      const tl = imageToCanvas(data.x1, data.y1);
      const br = imageToCanvas(data.x2, data.y2);
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    }

    ctx.setLineDash([]);

    // Draw accept/reject indicator at top-right of suggestion bounds
    let anchorX, anchorY;
    if (isPolygon) {
      const flat = (Array.isArray(data[0]?.[0]) ? data[0] : data);
      let maxX = -Infinity, minY = Infinity;
      for (const [px, py] of flat) {
        const cp = imageToCanvas(px, py);
        if (cp.x > maxX) maxX = cp.x;
        if (cp.y < minY) minY = cp.y;
      }
      anchorX = maxX;
      anchorY = minY;
    } else {
      const br = imageToCanvas(data.x2, data.y1);
      anchorX = br.x;
      anchorY = br.y;
    }

    // Checkmark button
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(anchorX + 4, anchorY - 20, 18, 18);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('\u2713', anchorX + 7, anchorY - 5);

    // X button
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(anchorX + 24, anchorY - 20, 18, 18);
    ctx.fillStyle = '#fff';
    ctx.fillText('\u2717', anchorX + 28, anchorY - 5);

    ctx.restore();
  }

  /** Draw a loading spinner. */
  function drawSpinner(ctx, w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const t = performance.now() / 600;
    ctx.save();
    ctx.strokeStyle = '#6C5CE7';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, 20, t, t + Math.PI * 1.5);
    ctx.stroke();
    ctx.restore();
  }

  /** Generate a deterministic color from a string (for user cursors). */
  function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 55%)`;
  }

  // -----------------------------------------------------------------------
  // Hit-testing: find which annotation is under a point (image coords)
  // -----------------------------------------------------------------------
  const hitTest = useCallback(
    (ix, iy) => {
      // Iterate in reverse so top-drawn annotations are checked first
      for (let i = annotations.length - 1; i >= 0; i--) {
        const ann = annotations[i];
        const data = parseData(ann.data);
        if (!data) continue;

        if (ann.type === 'polygon') {
          const contours = Array.isArray(data[0]?.[0]) ? data : [data];
          for (const contour of contours) {
            if (pointInPolygon(ix, iy, contour)) return ann;
          }
        } else if (ann.type === 'bbox') {
          if (pointInBbox(ix, iy, data)) return ann;
        }
      }
      return null;
    },
    [annotations]
  );

  // -----------------------------------------------------------------------
  // AI suggestion accept/reject hit test (canvas coords)
  // -----------------------------------------------------------------------
  const hitTestAiButtons = useCallback(
    (cx, cy) => {
      for (let i = 0; i < aiResults.length; i++) {
        const result = aiResults[i];
        const data = parseData(result.data || result.polygon || result);
        if (!data) continue;
        const isPolygon = Array.isArray(data);

        let anchorX, anchorY;
        if (isPolygon) {
          const flat = Array.isArray(data[0]?.[0]) ? data[0] : data;
          let maxX = -Infinity, minY = Infinity;
          for (const [px, py] of flat) {
            const cp = imageToCanvas(px, py);
            if (cp.x > maxX) maxX = cp.x;
            if (cp.y < minY) minY = cp.y;
          }
          anchorX = maxX;
          anchorY = minY;
        } else {
          const br = imageToCanvas(data.x2, data.y1);
          anchorX = br.x;
          anchorY = br.y;
        }

        // Checkmark button area
        if (
          cx >= anchorX + 4 && cx <= anchorX + 22 &&
          cy >= anchorY - 20 && cy <= anchorY - 2
        ) {
          return { index: i, action: 'accept', result };
        }
        // X button area
        if (
          cx >= anchorX + 24 && cx <= anchorX + 42 &&
          cy >= anchorY - 20 && cy <= anchorY - 2
        ) {
          return { index: i, action: 'reject', result };
        }
      }
      return null;
    },
    [aiResults, imageToCanvas]
  );

  // -----------------------------------------------------------------------
  // Polygon finish
  // -----------------------------------------------------------------------
  const finishPolygon = useCallback(
    async (points) => {
      if (!currentImage?.id || points.length < 3) return;
      const polygonData = points.map((p) => [p.x, p.y]);
      const newAnn = {
        image_id: currentImage.id,
        project_id: currentImage.project_id,
        label: activeLabel?.name || null,
        type: 'polygon',
        data: polygonData,
        source: 'manual',
      };
      try {
        const saved = await api.createAnnotation(newAnn);
        addAnnotation(saved);
        onAnnotationCreated?.(saved);
      } catch (err) {
        console.error('Failed to save polygon:', err);
        addAnnotation({ ...newAnn, id: 'temp-' + Date.now() });
      }
      setPolyPoints([]);
      polyMousePos.current = null;
    },
    [currentImage?.id, currentImage?.project_id, activeLabel, addAnnotation, onAnnotationCreated]
  );

  const finishBbox = useCallback(
    async (box) => {
      if (!currentImage?.id) return;
      const newAnn = {
        image_id: currentImage.id,
        project_id: currentImage.project_id,
        label: activeLabel?.name || null,
        type: 'bbox',
        data: box,
        source: 'manual',
      };
      try {
        const saved = await api.createAnnotation(newAnn);
        addAnnotation(saved);
        onAnnotationCreated?.(saved);
      } catch (err) {
        console.error('Failed to save bbox:', err);
        addAnnotation({ ...newAnn, id: 'temp-' + Date.now() });
      }
    },
    [currentImage?.id, currentImage?.project_id, activeLabel, addAnnotation, onAnnotationCreated]
  );

  // -----------------------------------------------------------------------
  // Mouse handlers
  // -----------------------------------------------------------------------

  const getCanvasPos = useCallback((e) => {
    const rect = overlayRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  // --- Mouse Down ---
  const handleMouseDown = useCallback(
    (e) => {
      const { x: cx, y: cy } = getCanvasPos(e);
      const { x: ix, y: iy } = canvasToImage(cx, cy);

      // Middle-click, space+click, or pan tool: start panning
      if (e.button === 1 || (isSpaceDown.current && e.button === 0) || (activeTool === 'pan' && e.button === 0)) {
        isPanning.current = true;
        setIsActivePan(true);
        dragStart.current = { x: cx, y: cy };
        dragStartPan.current = { x: pan.x, y: pan.y };
        e.preventDefault();
        return;
      }

      // Left click
      if (e.button === 0) {
        // Check AI suggestion buttons first
        const aiHit = hitTestAiButtons(cx, cy);
        if (aiHit) {
          if (aiHit.action === 'accept') {
            // Accept: convert AI suggestion to a real annotation
            const result = aiHit.result;
            const polygon = parseData(
              result.data || result.polygon || result
            );
            const newAnn = {
              id: 'temp-' + Date.now(),
              type: 'polygon',
              data: polygon,
              label: result.label || activeLabel?.name || null,
              confidence: result.score ?? null,
              source: 'ai-segment',
            };
            addAnnotation(newAnn);
            onAnnotationCreated?.(newAnn);
          }
          // Remove the suggestion regardless
          const updated = [...aiResults];
          updated.splice(aiHit.index, 1);
          setAiResults(updated);
          return;
        }

        if (activeTool === 'select') {
          const hit = hitTest(ix, iy);
          setSelectedAnnotation(hit);
          if (hit) {
            isDragging.current = true;
            dragStart.current = { x: ix, y: iy };
            dragAnnotationOrigin.current = {
              data: JSON.parse(JSON.stringify(parseData(hit.data))),
              startX: ix,
              startY: iy,
            };
          }
        } else if (activeTool === 'polygon') {
          const pt = { x: Math.round(ix), y: Math.round(iy) };
          if (polyPoints.length >= 3) {
            // Check if clicking near the first point to close
            const first = imageToCanvas(polyPoints[0].x, polyPoints[0].y);
            const { x: cx2, y: cy2 } = imageToCanvas(pt.x, pt.y);
            const dist = Math.hypot(cx2 - first.x, cy2 - first.y);
            if (dist < 12) {
              // Close polygon and save
              finishPolygon(polyPoints);
              return;
            }
          }
          setPolyPoints((prev) => [...prev, pt]);
        } else if (activeTool === 'click-segment') {
          // Left click = foreground point (label=1)
          const newPoints = [...segPoints, { x: Math.round(ix), y: Math.round(iy), label: 1 }];
          setSegPoints(newPoints);
          runClickSegment(newPoints);
        } else if (activeTool === 'bbox' || activeTool === 'box-segment') {
          boxDrawing.current = { x1: ix, y1: iy, x2: ix, y2: iy };
          isDragging.current = true;
        }
      }

      // Right click on click-segment: add negative point
      if (e.button === 2 && activeTool === 'click-segment') {
        e.preventDefault();
        const newPoints = [...segPoints, { x: Math.round(ix), y: Math.round(iy), label: 0 }];
        setSegPoints(newPoints);
        runClickSegment(newPoints);
      }
    },
    [
      getCanvasPos, canvasToImage, imageToCanvas, pan, activeTool, hitTest, hitTestAiButtons,
      segPoints, polyPoints, finishPolygon, activeLabel, aiResults, addAnnotation,
      setSelectedAnnotation, setAiResults, onAnnotationCreated,
    ]
  );

  // --- Mouse Move ---
  const handleMouseMove = useCallback(
    (e) => {
      const { x: cx, y: cy } = getCanvasPos(e);
      const { x: ix, y: iy } = canvasToImage(cx, cy);

      // Panning
      if (isPanning.current) {
        const dx = cx - dragStart.current.x;
        const dy = cy - dragStart.current.y;
        setPan({
          x: dragStartPan.current.x + dx,
          y: dragStartPan.current.y + dy,
        });
        return;
      }

      // Select tool: drag annotation
      if (isDragging.current && activeTool === 'select' && selectedAnnotation) {
        const origin = dragAnnotationOrigin.current;
        if (!origin) return;
        const dx = ix - origin.startX;
        const dy = iy - origin.startY;
        const origData = origin.data;

        let newData;
        if (selectedAnnotation.type === 'polygon') {
          const contours = Array.isArray(origData[0]?.[0])
            ? origData
            : [origData];
          newData = contours.map((contour) =>
            contour.map(([px, py]) => [px + dx, py + dy])
          );
          // Flatten back if it was a single contour
          if (!Array.isArray(parseData(selectedAnnotation.data)[0]?.[0])) {
            newData = newData[0];
          }
        } else if (selectedAnnotation.type === 'bbox') {
          newData = {
            x1: origData.x1 + dx,
            y1: origData.y1 + dy,
            x2: origData.x2 + dx,
            y2: origData.y2 + dy,
          };
        }
        if (newData) {
          updateAnnotation(selectedAnnotation.id, { data: newData });
        }
        return;
      }

      // Box drawing: update rectangle (both bbox and box-segment tools)
      if (isDragging.current && (activeTool === 'bbox' || activeTool === 'box-segment') && boxDrawing.current) {
        boxDrawing.current = {
          ...boxDrawing.current,
          x2: ix,
          y2: iy,
        };
        return;
      }

      // Update polygon preview line
      if (activeTool === 'polygon') {
        polyMousePos.current = { x: ix, y: iy };
      }

      // Cursor broadcasting (throttled)
      const now = performance.now();
      if (now - lastCursorBroadcast.current > CURSOR_BROADCAST_INTERVAL) {
        lastCursorBroadcast.current = now;
        broadcastCursor(ix, iy);
      }
    },
    [
      getCanvasPos, canvasToImage, activeTool, selectedAnnotation,
      setPan, updateAnnotation, polyPoints,
    ]
  );

  // --- Mouse Up ---
  const handleMouseUp = useCallback(
    (e) => {
      if (isPanning.current) {
        isPanning.current = false;
        setIsActivePan(false);
        return;
      }

      if (isDragging.current && (activeTool === 'bbox' || activeTool === 'box-segment') && boxDrawing.current) {
        isDragging.current = false;
        const b = boxDrawing.current;
        const box = {
          x1: Math.round(Math.min(b.x1, b.x2)),
          y1: Math.round(Math.min(b.y1, b.y2)),
          x2: Math.round(Math.max(b.x1, b.x2)),
          y2: Math.round(Math.max(b.y1, b.y2)),
        };
        if (box.x2 - box.x1 > 2 && box.y2 - box.y1 > 2) {
          if (activeTool === 'bbox') {
            finishBbox(box);
          } else {
            runBoxSegment(box);
          }
        }
        boxDrawing.current = null;
        return;
      }

      if (isDragging.current && activeTool === 'select') {
        isDragging.current = false;
        dragAnnotationOrigin.current = null;
        // Persist the moved annotation if needed
        if (selectedAnnotation) {
          onAnnotationCreated?.(selectedAnnotation);
        }
      }

      isDragging.current = false;
    },
    [activeTool, selectedAnnotation, onAnnotationCreated, finishBbox]
  );

  // --- Mouse Wheel (Zoom) ---
  const handleWheel = useCallback(
    (e) => {
      e.preventDefault();
      const { x: cx, y: cy } = getCanvasPos(e);

      const direction = e.deltaY < 0 ? 1 : -1;
      const factor = direction > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));

      // Zoom toward cursor position
      const newPanX = cx - (cx - pan.x) * (newZoom / zoom);
      const newPanY = cy - (cy - pan.y) * (newZoom / zoom);

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    },
    [zoom, pan, getCanvasPos, setZoom, setPan]
  );

  // --- Context menu (prevent default for right-click segment) ---
  const handleContextMenu = useCallback(
    (e) => {
      if (activeTool === 'click-segment') {
        e.preventDefault();
      }
    },
    [activeTool]
  );

  // -----------------------------------------------------------------------
  // Keyboard handlers (spacebar for panning)
  // -----------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        isSpaceDown.current = true;
        e.preventDefault();
      }
      if (e.code === 'Escape') {
        setSelectedAnnotation(null);
        setSegPoints([]);
        setPolyPoints([]);
        polyMousePos.current = null;
        boxDrawing.current = null;
      }
      if (e.code === 'Delete' || e.code === 'Backspace') {
        // Delete handled externally, but deselect if needed
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        isSpaceDown.current = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [setSelectedAnnotation]);

  // -----------------------------------------------------------------------
  // API calls
  // -----------------------------------------------------------------------

  const runClickSegment = useCallback(
    async (points) => {
      if (!currentImage?.id) return;
      setIsAiLoading(true);
      setAiProcessing(true);
      try {
        const apiPoints = points.map((p) => ({ x: p.x, y: p.y }));
        const apiLabels = points.map((p) => p.label);
        const results = await api.segmentClick({
          image_id: currentImage.id,
          points: apiPoints,
          labels: apiLabels,
        });

        // Results is an array of { polygon, rle, score }
        // Take the best result and present as AI suggestion
        if (results && results.length > 0) {
          const best = results[0]; // already sorted by score desc
          const suggestion = {
            polygon: best.polygon,
            data: best.polygon,
            score: best.score,
            rle: best.rle,
            label: activeLabel?.name || null,
          };
          setAiResults([suggestion]);
        }
      } catch (err) {
        console.error('Click segment failed:', err);
      } finally {
        setIsAiLoading(false);
        setAiProcessing(false);
      }
    },
    [currentImage?.id, activeLabel, setAiProcessing, setAiResults]
  );

  const runBoxSegment = useCallback(
    async (box) => {
      if (!currentImage?.id) return;
      setIsAiLoading(true);
      setAiProcessing(true);
      try {
        const result = await api.segmentBox({
          image_id: currentImage.id,
          box,
        });

        // result = { polygon, rle, score }
        if (result && result.polygon) {
          const suggestion = {
            polygon: result.polygon,
            data: result.polygon,
            score: result.score,
            rle: result.rle,
            label: activeLabel?.name || null,
          };
          setAiResults([suggestion]);
        }
      } catch (err) {
        console.error('Box segment failed:', err);
      } finally {
        setIsAiLoading(false);
        setAiProcessing(false);
      }
    },
    [currentImage?.id, activeLabel, setAiProcessing, setAiResults]
  );

  // -----------------------------------------------------------------------
  // Cursor broadcasting stub (uses WebSocket if available)
  // -----------------------------------------------------------------------
  const broadcastCursor = useCallback(
    (ix, iy) => {
      // The parent or a hook should provide a WebSocket send function.
      // We dispatch a custom event that the useWebSocket hook can listen for.
      window.dispatchEvent(
        new CustomEvent('datatail:cursor', {
          detail: { x: ix, y: iy },
        })
      );
    },
    []
  );

  // -----------------------------------------------------------------------
  // Cursor style
  // -----------------------------------------------------------------------
  const [isActivePan, setIsActivePan] = useState(false);

  const cursorStyle = useMemo(() => {
    if (isActivePan) return 'grabbing';
    if (isSpaceDown.current) return 'grab';
    switch (activeTool) {
      case 'select':
        return 'default';
      case 'click-segment':
        return 'crosshair';
      case 'bbox':
        return 'crosshair';
      case 'box-segment':
        return 'crosshair';
      case 'pan':
        return 'grab';
      case 'zoom':
        return 'zoom-in';
      default:
        return 'default';
    }
  }, [activeTool, isActivePan]);

  // -----------------------------------------------------------------------
  // Attach wheel listener with { passive: false } to allow preventDefault
  // -----------------------------------------------------------------------
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.addEventListener('wheel', handleWheel, { passive: false });
    return () => overlay.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Reset segment/polygon points when tool changes
  useEffect(() => {
    setSegPoints([]);
    setPolyPoints([]);
    polyMousePos.current = null;
    boxDrawing.current = null;
  }, [activeTool]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        background: '#1a1a1a',
      }}
    >
      {/* Image layer */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0 }}
      />
      {/* Overlay: annotations, interaction, cursors */}
      <canvas
        ref={overlayRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          cursor: cursorStyle,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          isPanning.current = false;
          isDragging.current = false;
          setIsActivePan(false);
        }}
        onContextMenu={handleContextMenu}
        onDoubleClick={(e) => {
          if (activeTool === 'polygon' && polyPoints.length >= 3) {
            finishPolygon(polyPoints);
          }
        }}
      />
      {/* Image loading indicator */}
      {isImageLoading && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#888',
            fontSize: 14,
            fontFamily: 'sans-serif',
            userSelect: 'none',
          }}
        >
          Loading image...
        </div>
      )}
      {/* No image placeholder */}
      {!currentImage && !isImageLoading && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#555',
            fontSize: 14,
            fontFamily: 'sans-serif',
            userSelect: 'none',
            textAlign: 'center',
          }}
        >
          No image selected.<br />
          Select an image from the sidebar to begin annotating.
        </div>
      )}
    </div>
  );
}
