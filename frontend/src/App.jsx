import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Database } from 'lucide-react';
import FileUpload from './components/FileUpload';
import DataPreprocessingWizard from './components/DataPreprocessingWizard';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import WelcomeScreen from './components/WelcomeScreen';
import Sidebar from './components/Sidebar';
import SplashScreen from './components/SplashScreen';
import TopBar from './components/TopBar';
import StatusBar from './components/StatusBar';
import ModelLab from './components/ModelLab';
import FinancialGlobe from './components/FinancialGlobe';
import { useChat } from './hooks/useChat';

const PROCESSING_STAGES = [
  'Analyzing your question…',
  'Querying your data…',
  'Processing results…',
  'Generating response…',
];

export default function App() {
  const [showSplash, setShowSplash]       = useState(true);
  const [sidebarOpen, setSidebarOpen]     = useState(true);
  const [showUpload, setShowUpload]       = useState(false);
  const [modelLabOpen, setModelLabOpen]   = useState(false);
  const [globeOpen, setGlobeOpen]         = useState(false);
  const [stageIdx, setStageIdx]           = useState(0);
  const [mode, setMode]                   = useState('auto');
  const [webSearch, setWebSearch]         = useState(false);
  const stageTimer = useRef(null);

  const chat = useChat();

  // Derive compliance status from most recent AI message
  const complianceStatus = (() => {
    const aiMsgs = chat.messages.filter(m => m.role === 'assistant' && m.compliance);
    if (aiMsgs.length === 0) return null;
    const last = aiMsgs[aiMsgs.length - 1];
    return last.compliance?.status || null;
  })();

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

  // Auto-open modal when preprocessResult arrives
  useEffect(() => {
    if (chat.preprocessResult) setShowUpload(true);
  }, [chat.preprocessResult]);

  const handleSuggestionClick = useCallback((text) => {
    if (text === '__upload__') {
      setShowUpload(true);
    } else {
      chat.sendMessage(text, mode, webSearch);
    }
  }, [chat, mode, webSearch]);

  const handleSend = useCallback((text) => {
    chat.sendMessage(text, mode, webSearch);
  }, [chat, mode, webSearch]);

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

        {/* Main area */}
        <div className="main-area">
          {/* Top bar */}
          <TopBar
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(v => !v)}
            tables={chat.tables}
            sessionId={chat.sessionId}
            onExportPDF={chat.exportPDF}
            onOpenModelLab={() => setModelLabOpen(true)}
            onOpenGlobe={() => setGlobeOpen(true)}
            complianceStatus={complianceStatus}
          />

          {/* Messages viewport */}
          <div className="messages-viewport">
            <div className="messages-inner">
              {!hasMessages && (
                <WelcomeScreen
                  onAction={handleSuggestionClick}
                  onSampleLoad={chat.loadSampleDataset}
                  hasDataset={!!chat.fileInfo}
                />
              )}

              {chat.messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  onSendMessage={handleSend}
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
                  <div className="msg-system-card" style={{ color: 'var(--error)', borderColor: 'rgba(220,38,38,0.2)' }}>
                    {chat.error}
                  </div>
                </div>
              )}

              <div ref={chat.messagesEndRef} />
            </div>
          </div>

          {/* Upload / Preprocessing modal */}
          {(showUpload || chat.preprocessResult) && (
            <div
              style={{
                position: 'fixed', inset: 0, zIndex: 50,
                background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '24px',
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget && !chat.preprocessResult) setShowUpload(false);
              }}
            >
              <div style={{
                background: '#ffffff', borderRadius: 20,
                boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
                padding: '32px 28px', position: 'relative',
              }}>
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
                    onFileLoaded={(file) => chat.handleUpload(file)}
                    disabled={chat.isLoading}
                  />
                )}

                {chat.preprocessResult && (
                  <DataPreprocessingWizard
                    detectResult={chat.preprocessResult}
                    onComplete={(result) => { setShowUpload(false); chat.finalizeUpload(result); }}
                    onSkip={() => { setShowUpload(false); chat.skipPreprocessing(); }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Input area */}
          <div className="input-area">
            <div className="input-inner">
              <ChatInput
                onSend={handleSend}
                onFileClick={() => setShowUpload(true)}
                disabled={chat.isLoading}
                placeholder={chat.fileInfo ? `Ask about ${chat.fileInfo.name}…` : 'Upload a dataset or ask a question…'}
                mode={mode}
                onModeChange={setMode}
                webSearch={webSearch}
                onWebSearchChange={setWebSearch}
              />
            </div>
          </div>

          {/* Status bar */}
          <StatusBar
            sessionId={chat.sessionId}
            tables={chat.tables}
          />
        </div>
      </div>

      {/* Financial Globe overlay */}
      <FinancialGlobe
        isOpen={globeOpen}
        onClose={() => setGlobeOpen(false)}
      />

      {/* Model Lab overlay */}
      <ModelLab
        isOpen={modelLabOpen}
        onClose={() => setModelLabOpen(false)}
        sessionId={chat.sessionId}
        schema={chat.schema}
        onDiscussInChat={(text) => { chat.sendMessage(text, 'auto', false); }}
      />
    </>
  );
}
