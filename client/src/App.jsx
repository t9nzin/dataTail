import { Component, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProjectList from './components/ProjectList';
import ProjectView from './components/ProjectView';
import { useStore } from './store';
import * as api from './api';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('React error boundary caught:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: '#ff4a4a', background: '#1e1e1e', height: '100vh', fontFamily: 'monospace' }}>
          <h2>Something went wrong</h2>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#e0e0e0', marginTop: 16 }}>
            {this.state.error.toString()}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 16, padding: '8px 16px', background: '#4a9eff', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function LoadingScreen() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#f4f5f7',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{ textAlign: 'center' }}>
        <svg width="40" height="40" viewBox="0 0 36 36" fill="none" style={{ marginBottom: 16 }}>
          <rect width="36" height="36" rx="10" fill="#6C5CE7" />
          <path d="M18 8l-8 14h5v6l8-14h-5v-6z" fill="white" opacity="0.9" />
        </svg>
        <div style={{
          fontSize: 13,
          color: '#888',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}>
          Loading...
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const setUserIdentity = useStore((s) => s.setUserIdentity);
  const setIdentityReady = useStore((s) => s.setIdentityReady);
  const identityReady = useStore((s) => s.identityReady);

  useEffect(() => {
    api.fetchMe()
      .then((me) => setUserIdentity(me))
      .catch(() => setIdentityReady(true));
  }, []);

  if (!identityReady) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ProjectList />} />
          <Route path="/project/:projectId" element={<ProjectView />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
