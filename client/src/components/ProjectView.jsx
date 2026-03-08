import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useStore } from '../store';
import { useWebSocket } from '../hooks/useWebSocket';
import * as api from '../api';
import TopBar from './TopBar';
import Toolbar from './Toolbar';
import AnnotationCanvas from './AnnotationCanvas';
import Sidebar from './Sidebar';
import ChatPanel from './ChatPanel';
import DashboardPanel from './DashboardPanel';
import ReviewPanel from './ReviewPanel';
import ExportPanel from './ExportPanel';
import BottomBar from './BottomBar';

export default function ProjectView() {
  const { projectId } = useParams();
  const currentProject = useStore((s) => s.currentProject);
  const setCurrentProject = useStore((s) => s.setCurrentProject);
  const setImages = useStore((s) => s.setImages);
  const setLabelClasses = useStore((s) => s.setLabelClasses);
  const setActiveLabel = useStore((s) => s.setActiveLabel);
  const setAnnotations = useStore((s) => s.setAnnotations);
  const setCurrentImage = useStore((s) => s.setCurrentImage);
  const images = useStore((s) => s.images);
  const currentImage = useStore((s) => s.currentImage);
  const clearChat = useStore((s) => s.clearChat);

  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [annotationsVisible, setAnnotationsVisible] = useState(true);
  const loadingRef = useRef(false);
  const [uiScale, setUiScale] = useState(1);

  // Scale UI chrome proportionally on smaller screens (designed for 16" MBP @ 1728px)
  useEffect(() => {
    const DESIGN_WIDTH = 1728;
    const update = () => {
      setUiScale(Math.min(1, window.innerWidth / DESIGN_WIDTH));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const { subscribeToImage } = useWebSocket();

  // Load project data on mount or when projectId changes
  useEffect(() => {
    async function loadProject() {
      if (!projectId || loadingRef.current) return;
      loadingRef.current = true;
      // Clear stale image immediately so the canvas doesn't flash the previous project's image
      setCurrentImage(null);
      setImages([]);
      try {
        const project = await api.fetchProject(projectId);
        setCurrentProject(project);

        const [imgs, labels] = await Promise.all([
          api.fetchImages(projectId),
          api.fetchLabels(projectId),
        ]);

        setImages(imgs);
        setLabelClasses(labels);
        setAnnotations([]);
        clearChat();

        if (labels.length > 0) {
          setActiveLabel(labels[0]);
        }

        // Always select the first image of the new project (or clear if empty)
        setCurrentImage(imgs.length > 0 ? imgs[0] : null);
      } catch (err) {
        console.error('Failed to load project:', err);
      } finally {
        loadingRef.current = false;
      }
    }

    loadProject();
  }, [projectId]);

  // Load annotations when current image changes
  useEffect(() => {
    async function loadAnnotations() {
      if (!currentImage) {
        setAnnotations([]);
        return;
      }
      try {
        const anns = await api.fetchAnnotations(currentImage.id);
        setAnnotations(anns);
        subscribeToImage(currentImage.id);
      } catch (err) {
        console.error('Failed to load annotations:', err);
      }
    }

    loadAnnotations();
  }, [currentImage?.id]);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#f0f0f0',
        color: '#333',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* TopBar at top */}
      <TopBar
        uiScale={uiScale}
        onOpenDashboard={() => setDashboardOpen(true)}
        onOpenReview={() => setReviewOpen(true)}
        onOpenExport={() => setExportOpen(true)}
        annotationsVisible={annotationsVisible}
        onToggleAnnotationVisibility={() => setAnnotationsVisible((v) => !v)}
        onNavigateImage={(dir) => {
          const idx = currentImage ? images.findIndex((img) => img.id === currentImage.id) : -1;
          const nextIdx = dir === 'next' ? idx + 1 : idx - 1;
          if (nextIdx >= 0 && nextIdx < images.length) {
            setCurrentImage(images[nextIdx]);
          }
        }}
      />

      {/* Middle row: Sidebar (left) | AnnotationCanvas (center) | Toolbar (right) */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar on the LEFT (icon tabs + content panel) */}
        <Sidebar uiScale={uiScale} />

        {/* Center: Canvas + BottomBar stacked vertically, with Toolbar overlaid */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          <AnnotationCanvas annotationsVisible={annotationsVisible} />
          {/* BottomBar and Toolbar float over the canvas */}
          <BottomBar uiScale={uiScale} />
          <Toolbar uiScale={uiScale} chatOpen={chatOpen} onToggleChat={() => setChatOpen((v) => !v)} />
          {/* ChatPanel floats to the left of the toolbar */}
          {chatOpen && <ChatPanel uiScale={uiScale} onClose={() => setChatOpen(false)} />}
        </div>
      </div>

      {/* DashboardPanel and ReviewPanel as modals (overlays) */}
      <DashboardPanel
        isOpen={dashboardOpen}
        onClose={() => setDashboardOpen(false)}
      />

      <ReviewPanel
        isOpen={reviewOpen}
        onClose={() => setReviewOpen(false)}
      />

      <ExportPanel
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
      />
    </div>
  );
}
