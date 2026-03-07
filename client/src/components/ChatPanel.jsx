import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import * as api from '../api';

const ACCENT = '#6C5CE7';

function BouncingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px' }}>
      <style>{`
        @keyframes chatBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: ACCENT,
            animation: `chatBounce 1.2s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

export default function ChatPanel({ uiScale = 1, onClose }) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const currentImage = useStore((s) => s.currentImage);
  const addChatMessage = useStore((s) => s.addChatMessage);
  const removeChatMessage = useStore((s) => s.removeChatMessage);
  const chatMessages = useStore((s) => s.chatMessages);
  const currentProject = useStore((s) => s.currentProject);
  const activeLabel = useStore((s) => s.activeLabel);
  const chatHistory = useStore((s) => s.chatHistory);
  const setChatHistory = useStore((s) => s.setChatHistory);
  const setAnnotations = useStore((s) => s.setAnnotations);
  const setAiResults = useStore((s) => s.setAiResults);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  async function handleSend() {
    const command = input.trim();
    if (!command || !currentImage) return;

    setInput('');

    addChatMessage({
      id: Date.now(),
      role: 'user',
      text: command,
      timestamp: new Date().toISOString(),
    });

    const loadingId = Date.now() + 1;
    addChatMessage({
      id: loadingId,
      role: 'system',
      text: '',
      isLoading: true,
      timestamp: new Date().toISOString(),
    });

    try {
      const result = await api.agentChat(
        currentImage.id,
        command,
        currentProject?.id,
        chatHistory,
      );

      removeChatMessage(loadingId);

      const resultAnnotations = result.annotations || [];
      const message = result.message || `Found ${resultAnnotations.length} result(s)`;

      if (result.history) {
        setChatHistory(result.history);
      }

      if (result.actions && result.actions.length > 0) {
        try {
          const fresh = await api.fetchAnnotations(currentImage.id);
          setAnnotations(fresh);
        } catch {
          // ignore refresh errors
        }
      }

      if (resultAnnotations.length > 0) {
        const suggestions = resultAnnotations.map((ann) => ({
          data: ann.polygon,
          polygon: ann.polygon,
          score: ann.confidence ?? null,
          bbox: ann.bbox,
          rle: ann.rle,
          label: ann.label || activeLabel?.name || null,
          source: 'nl-agent',
          type: 'polygon',
        }));
        setAiResults(suggestions);
      }

      addChatMessage({
        id: Date.now() + 2,
        role: 'assistant',
        text: message,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      removeChatMessage(loadingId);
      addChatMessage({
        id: Date.now() + 2,
        role: 'assistant',
        text: `Error: ${err.message}`,
        isError: true,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        right: 117,
        bottom: 18,
        width: 340,
        height: 420,
        background: '#fff',
        borderRadius: 20,
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        border: '1px solid #e8e8e8',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 20,
        zoom: uiScale,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px 12px',
          borderBottom: '1px solid #f0f0f0',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', letterSpacing: 0.2 }}>
            AI Assistant
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#aaa',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; e.currentTarget.style.color = '#666'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#aaa'; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {chatMessages.length === 0 && (
          <div style={{ color: '#aaa', fontSize: 12, textAlign: 'center', marginTop: 32, lineHeight: 1.6 }}>
            Try: "find all cars", "label dogs",<br />"count objects"
          </div>
        )}

        {chatMessages.map((msg) => {
          if (msg.role === 'user') {
            return (
              <div
                key={msg.id}
                style={{
                  alignSelf: 'flex-end',
                  background: ACCENT,
                  color: '#fff',
                  padding: '8px 14px',
                  borderRadius: '14px 14px 4px 14px',
                  fontSize: 13,
                  maxWidth: '80%',
                  wordBreak: 'break-word',
                  lineHeight: 1.4,
                }}
              >
                {msg.text}
              </div>
            );
          }

          if (msg.role === 'system') {
            if (msg.isLoading) {
              return (
                <div key={msg.id} style={{ alignSelf: 'flex-start' }}>
                  <div style={{ background: '#f5f5f7', borderRadius: '14px 14px 14px 4px', display: 'inline-block' }}>
                    <BouncingDots />
                  </div>
                </div>
              );
            }
            return (
              <div key={msg.id} style={{ alignSelf: 'center', color: '#999', fontSize: 11, fontStyle: 'italic' }}>
                {msg.text}
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              style={{
                alignSelf: 'flex-start',
                maxWidth: '85%',
              }}
            >
              <div
                style={{
                  background: msg.isError ? '#fdf0f0' : '#f5f5f7',
                  color: msg.isError ? '#e74c3c' : '#333',
                  padding: '8px 14px',
                  borderRadius: '14px 14px 14px 4px',
                  fontSize: 13,
                  wordBreak: 'break-word',
                  lineHeight: 1.4,
                  border: msg.isError ? '1px solid #f5c6c6' : 'none',
                }}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '12px 14px',
          borderTop: '1px solid #f0f0f0',
          flexShrink: 0,
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={currentImage ? '"find all cars"...' : 'Select an image first'}
          disabled={!currentImage}
          style={{
            flex: 1,
            padding: '9px 12px',
            background: '#f5f5f7',
            border: '1px solid #e8e8e8',
            borderRadius: 10,
            color: '#333',
            fontSize: 13,
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = ACCENT; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#e8e8e8'; }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || !currentImage}
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: input.trim() && currentImage ? ACCENT : '#e8e8e8',
            color: input.trim() && currentImage ? '#fff' : '#bbb',
            border: 'none',
            borderRadius: 10,
            cursor: input.trim() && currentImage ? 'pointer' : 'default',
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
