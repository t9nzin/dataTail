import { create } from 'zustand'

export const useStore = create((set, get) => ({
  // Projects
  projects: [],
  currentProject: null,
  setProjects: (projects) => set({ projects }),
  setCurrentProject: (project) => set({ currentProject: project, reviewIssues: [], reviewHasRun: false, aiResults: [], annotations: [], selectedAnnotation: null }),

  // Images
  images: [],
  currentImage: null,
  setImages: (images) => set({ images }),
  setCurrentImage: (image) => set({ currentImage: image, highlightRegion: null, aiResults: [], selectedAnnotation: null }),
  updateImage: (id, data) => set(s => ({
    images: s.images.map(img => img.id === id ? { ...img, ...data } : img),
    currentImage: s.currentImage?.id === id ? { ...s.currentImage, ...data } : s.currentImage,
  })),

  // Annotations for current image
  annotations: [],
  selectedAnnotation: null,
  _undoStack: [],
  _redoStack: [],
  _pushUndo: () => set(s => ({
    _undoStack: [...s._undoStack.slice(-49), s.annotations],
    _redoStack: [],
  })),
  canUndo: false,
  canRedo: false,
  undo: () => set(s => {
    if (s._undoStack.length === 0) return s;
    const prev = s._undoStack[s._undoStack.length - 1];
    return {
      _undoStack: s._undoStack.slice(0, -1),
      _redoStack: [...s._redoStack, s.annotations],
      annotations: prev,
      selectedAnnotation: null,
      canUndo: s._undoStack.length - 1 > 0,
      canRedo: true,
    };
  }),
  redo: () => set(s => {
    if (s._redoStack.length === 0) return s;
    const next = s._redoStack[s._redoStack.length - 1];
    return {
      _redoStack: s._redoStack.slice(0, -1),
      _undoStack: [...s._undoStack, s.annotations],
      annotations: next,
      selectedAnnotation: null,
      canUndo: true,
      canRedo: s._redoStack.length - 1 > 0,
    };
  }),
  setAnnotations: (annotations) => set({ annotations, _undoStack: [], _redoStack: [], canUndo: false, canRedo: false }),
  addAnnotation: (ann) => set(s => {
    if (ann.id && s.annotations.some(a => a.id === ann.id)) return s;
    const newUndo = [...s._undoStack.slice(-49), s.annotations];
    return { annotations: [...s.annotations, ann], _undoStack: newUndo, _redoStack: [], canUndo: true, canRedo: false };
  }),
  updateAnnotation: (id, data) => set(s => {
    const newUndo = [...s._undoStack.slice(-49), s.annotations];
    return {
      annotations: s.annotations.map(a => a.id === id ? { ...a, ...data } : a),
      _undoStack: newUndo, _redoStack: [], canUndo: true, canRedo: false,
    };
  }),
  removeAnnotation: (id) => set(s => {
    const newUndo = [...s._undoStack.slice(-49), s.annotations];
    return {
      annotations: s.annotations.filter(a => a.id !== id),
      _undoStack: newUndo, _redoStack: [], canUndo: true, canRedo: false,
    };
  }),
  setSelectedAnnotation: (ann) => set({ selectedAnnotation: ann }),

  // Label classes
  labelClasses: [],
  activeLabel: null,
  setLabelClasses: (classes) => set({ labelClasses: classes }),
  setActiveLabel: (label) => set({ activeLabel: label }),

  // Tool state
  activeTool: 'select', // 'select', 'click-segment', 'box-segment', 'pan', 'zoom'
  setActiveTool: (tool) => set({ activeTool: tool }),

  // Canvas state
  zoom: 1,
  pan: { x: 0, y: 0 },
  setZoom: (zoom) => set({ zoom }),
  setPan: (pan) => set({ pan }),

  // AI state
  isAiProcessing: false,
  aiResults: [], // pending AI suggestions
  setAiProcessing: (v) => set({ isAiProcessing: v }),
  setAiResults: (results) => set({ aiResults: results }),
  clearAiResults: () => set({ aiResults: [] }),

  // Chat messages (NL annotation)
  chatMessages: [],
  addChatMessage: (msg) => set(s => ({ chatMessages: [...s.chatMessages, msg] })),
  removeChatMessage: (id) => set(s => ({ chatMessages: s.chatMessages.filter(m => m.id !== id) })),
  clearChat: () => set({ chatMessages: [], chatHistory: [] }),

  // Ollama conversation history (for multi-turn agent chat)
  chatHistory: [],
  setChatHistory: (history) => set({ chatHistory: history }),

  // Review issues
  reviewIssues: [],
  reviewHasRun: false,
  setReviewIssues: (issues) => set({ reviewIssues: issues }),
  setReviewHasRun: (v) => set({ reviewHasRun: v }),

  // Highlight region for missing annotations (dashed orange box on canvas)
  highlightRegion: null, // { x1, y1, x2, y2, label }
  setHighlightRegion: (region) => set({ highlightRegion: region }),

  // Dataset health
  datasetHealth: null,
  setDatasetHealth: (health) => set({ datasetHealth: health }),

  // Connected users (presence) — array of username strings
  connectedUsers: [],
  setConnectedUsers: (users) => set({
    connectedUsers: users.map(u => typeof u === 'string' ? u : u.user || '?')
  }),

  // User cursors
  cursors: {},
  setCursor: (user, pos) => set(s => ({
    cursors: { ...s.cursors, [user]: pos }
  })),
  removeCursor: (user) => set(s => {
    const { [user]: _, ...rest } = s.cursors;
    return { cursors: rest };
  }),

  // Current user identity
  currentUser: 'local-user',
  identityReady: false,
  userIdentity: {
    login: 'local-user',
    displayName: '',
    profilePicUrl: '',
    tailnet: '',
    isAdmin: false,
  },
  setCurrentUser: (user) => set({ currentUser: user }),
  setUserIdentity: (identity) => set({
    currentUser: identity.login,
    userIdentity: identity,
    identityReady: true,
  }),
  setIdentityReady: (ready) => set({ identityReady: ready }),
}))
