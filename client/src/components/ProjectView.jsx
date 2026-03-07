import { useState, useEffect } from 'react';
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

  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [annotationsVisible, setAnnotationsVisible] = useState(true);
  const [loading, setLoading] = useState(true);

  const { subscribeToImage } = useWebSocket();

  // Load project data on mount or when projectId changes
  useEffect(() => {
    async function loadProject() {
      if (!projectId) return;
      setLoading(true);
      try {
        const project = await api.fetchProject(projectId);
        setCurrentProject(project);

        const [imgs, labels] = await Promise.all([
          api.fetchImages(projectId),
          api.fetchLabels(projectId),
        ]);

        setImages(imgs);
        setLabelClasses(labels);

        if (labels.length > 0) {
          setActiveLabel(labels[0]);
        }

        // Select first image if none selected
        if (imgs.length > 0 && !currentImage) {
          setCurrentImage(imgs[0]);
        }
      } catch (err) {
        console.error('Failed to load project:', err);
      } finally {
        setLoading(false);
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

  if (loading) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          background: '#f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
          fontSize: 14,
        }}
      >
        Loading project...
      </div>
    );
  }

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
        onOpenDashboard={() => setDashboardOpen(true)}
        onOpenReview={() => setReviewOpen(true)}
        annotationsVisible={annotationsVisible}
        onToggleAnnotations={() => setAnnotationsVisible((v) => !v)}
      />

      {/* Middle row: Sidebar (left) | AnnotationCanvas (center) | Toolbar (right) */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar on the LEFT (icon tabs + content panel) */}
        <Sidebar />

        {/* Center: Canvas + BottomBar stacked vertically */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <AnnotationCanvas annotationsVisible={annotationsVisible} />
          <BottomBar />
        </div>

        {/* Toolbar on the RIGHT (tool strip) */}
        <Toolbar onToggleChat={() => setChatOpen((v) => !v)} />
      </div>

      {/* ChatPanel at the very bottom (collapsible) */}
      {chatOpen && <ChatPanel />}

      {/* DashboardPanel and ReviewPanel as modals (overlays) */}
      <DashboardPanel
        isOpen={dashboardOpen}
        onClose={() => setDashboardOpen(false)}
      />

      <ReviewPanel
        isOpen={reviewOpen}
        onClose={() => setReviewOpen(false)}
      />
    </div>
  );
}
