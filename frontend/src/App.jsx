import React, { useState, useCallback, useEffect, useRef } from 'react';
import { PanelLeftClose, PanelLeft, Database } from 'lucide-react';
import FileUpload from './components/FileUpload';
import DataPreprocessingWizard from './components/DataPreprocessingWizard';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import WelcomeScreen from './components/WelcomeScreen';
import Sidebar from './components/Sidebar';
import BackendStatus from './components/BackendStatus';
import SplashScreen from './components/SplashScreen';
import { useChat } from './hooks/useChat';

const PROCESSING_STAGES = [
  'Analyzing your question…',
  'Querying your data…',
  'Processing results…',
  'Generating response…',
];

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const stageTimer = useRef(null);

  const chat = useChat();

  // Cycle through processing stages while loading
  useEffect(() => {
    if (chat.isLoading) {
      setStageIdx(0);
      stageTimer.current = setInterval(() => {
        setStageIdx(i => (i + 1) % PROCESSING_STAGES.length);
      }, 2200);
    } else {
      clearInterval(stageTimer.current);
    }
    return () => clearInterval(stageTimer.current);
  }, [chat.isLoading]);

  // Auto-open modal when preprocessResult arrives (file uploaded, wizard ready)
  useEffect(() => {
    if (chat.preprocessResult) setShowUpload(true);
  }, [chat.preprocessResult]);

  const handleSuggestionClick = useCallback((text) => {
    if (text === '__upload__') {
      setShowUpload(true);
    } else {
      chat.sendMessage(text);
    }
  }, [chat]);

  const hasMessages = chat.messages.length > 0;

  return (
    <>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      <div className="app-shell">
        {/* Sidebar */}
        <Sidebar
        isOpen={sidebarOpen}
        fileData={chat.fileInfo}
        onNewChat={chat.resetChat}
        onClearDataset={chat.resetChat}
        onExportPDF={chat.exportPDF}
        sessionId={chat.sessionId}
        semanticLayer={chat.semanticLayer}
        onUpdateSemanticLayer={chat.setSemanticLayer}
        schema={chat.schema}
        dataQuality={chat.dataQuality}
        sensitiveColumns={chat.sensitiveColumns}
        onUpdateSensitiveColumns={chat.setSensitiveColumns}
        tables={chat.tables}
      />

      {/* Main */}
      <div className="main-area">
        {/* Topbar */}
        <header className="topbar">
          <button className="topbar-btn" onClick={() => setSidebarOpen(v => !v)} title="Toggle sidebar">
            {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
          </button>
          <div className="topbar-divider" />
          <span className="topbar-title">
            {Object.keys(chat.tables).length > 0
              ? Object.keys(chat.tables).join(' · ')
              : 'DataTalk'}
          </span>
          {Object.keys(chat.tables).length > 0 && (
            <span className="topbar-badge" style={{ marginLeft: 4 }}>
              {Object.keys(chat.tables).length === 1 ? 'Dataset active' : `${Object.keys(chat.tables).length} tables active`}
            </span>
          )}
          <div style={{ flex: 1 }} />
          <BackendStatus />
        </header>

        {/* Messages */}
        <div className="messages-viewport">
          <div className="messages-inner">
            {!hasMessages && (
              <WelcomeScreen onAction={handleSuggestionClick} hasDataset={!!chat.fileInfo} />
            )}

            {chat.messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onSendMessage={chat.sendMessage}
              />
            ))}

            {chat.isLoading && (
              <div className="thinking-wrapper">
                <div className="msg-ai-avatar">
                  <Database size={13} />
                </div>
                <div>
                  <div className="thinking-dots">
                    <span /><span /><span />
                  </div>
                  <div className="thinking-text">{PROCESSING_STAGES[stageIdx]}</div>
                </div>
              </div>
            )}

            {chat.error && !chat.isLoading && !hasMessages && (
              <div className="msg-system anim-fade-in">
                <div className="msg-system-card" style={{ color: 'var(--error)', borderColor: 'rgba(220,38,38,0.2)', background: '#fef2f2' }}>
                  {chat.error}
                </div>
              </div>
            )}

            <div ref={chat.messagesEndRef} />
          </div>
        </div>

        {/* Upload / Preprocessing Modal — sits above chat, never interrupts messages */}
        {(showUpload || chat.preprocessResult) && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 50,
              background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '24px',
            }}
            onClick={(e) => {
              // Close only if clicking the backdrop (not the modal content) and no wizard active
              if (e.target === e.currentTarget && !chat.preprocessResult) {
                setShowUpload(false);
              }
            }}
          >
            <div
              style={{
                background: '#fff', borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
                width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
                padding: '32px 28px', position: 'relative',
              }}
            >
              {/* Close button — only when no wizard pending */}
              {!chat.preprocessResult && (
                <button
                  onClick={() => setShowUpload(false)}
                  style={{
                    position: 'absolute', top: 14, right: 14,
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 20, color: '#9ca3af', lineHeight: 1,
                  }}
                  title="Close"
                >✕</button>
              )}

              {showUpload && !chat.preprocessResult && (
                <FileUpload
                  onFileLoaded={(file) => {
                    chat.handleUpload(file);
                  }}
                  disabled={chat.isLoading}
                />
              )}

              {chat.preprocessResult && (
                <DataPreprocessingWizard
                  detectResult={chat.preprocessResult}
                  onComplete={(result) => {
                    setShowUpload(false);
                    chat.finalizeUpload(result);
                  }}
                  onSkip={() => {
                    setShowUpload(false);
                    chat.skipPreprocessing();
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="input-area">
          <div className="input-inner">
            <ChatInput
              onSend={chat.sendMessage}
              onFileClick={() => setShowUpload(true)}
              disabled={chat.isLoading}
              placeholder={chat.fileInfo ? `Ask about ${chat.fileInfo.name}…` : 'Upload a dataset or ask a question…'}
            />
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
