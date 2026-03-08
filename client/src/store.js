import { create } from 'zustand'

export const useStore = create((set, get) => ({
  // Projects
  projects: [],
  currentProject: null,
  setProjects: (projects) => set({ projects }),
  setCurrentProject: (project) => set({ currentProject: project }),

  // Images
  images: [],
  currentImage: null,
  setImages: (images) => set({ images }),
  setCurrentImage: (image) => set({ currentImage: image }),
  updateImage: (id, data) => set(s => ({
    images: s.images.map(img => img.id === id ? { ...img, ...data } : img),
    currentImage: s.currentImage?.id === id ? { ...s.currentImage, ...data } : s.currentImage,
  })),

  // Annotations for current image
  annotations: [],
  selectedAnnotation: null,
  setAnnotations: (annotations) => set({ annotations }),
  addAnnotation: (ann) => set(s => {
    if (ann.id && s.annotations.some(a => a.id === ann.id)) return s;
    return { annotations: [...s.annotations, ann] };
  }),
  updateAnnotation: (id, data) => set(s => ({
    annotations: s.annotations.map(a => a.id === id ? { ...a, ...data } : a)
  })),
  removeAnnotation: (id) => set(s => ({
    annotations: s.annotations.filter(a => a.id !== id)
  })),
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
  setReviewIssues: (issues) => set({ reviewIssues: issues }),

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
