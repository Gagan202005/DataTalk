import React, { useState, useCallback, useEffect, useRef } from 'react';
import { PanelLeftClose, PanelLeft, Database } from 'lucide-react';
import FileUpload from './components/FileUpload';
import DataPreprocessingWizard from './components/DataPreprocessingWizard';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import WelcomeScreen from './components/WelcomeScreen';
import Sidebar from './components/Sidebar';
import BackendStatus from './components/BackendStatus';
import { useChat } from './hooks/useChat';

const PROCESSING_STAGES = [
  'Analyzing your question…',
  'Querying your data…',
  'Processing results…',
  'Generating response…',
];

export default function App() {
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

  const handleSuggestionClick = useCallback((text) => {
    if (text === '__upload__') {
      setShowUpload(true);
    } else {
      chat.sendMessage(text);
    }
  }, [chat]);

  const hasMessages = chat.messages.length > 0;

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        fileData={chat.fileInfo}
        onNewChat={chat.resetChat}
        onClearDataset={chat.resetChat}
        onExportPDF={chat.exportPDF}
        semanticLayer={chat.semanticLayer}
        onUpdateSemanticLayer={chat.setSemanticLayer}
        schema={chat.schema}
        dataQuality={chat.dataQuality}
        sensitiveColumns={chat.sensitiveColumns}
        onUpdateSensitiveColumns={chat.setSensitiveColumns}
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
            {chat.fileInfo ? chat.fileInfo.name : 'DataTalk'}
          </span>
          {chat.fileInfo && (
            <span className="topbar-badge" style={{ marginLeft: 4 }}>Dataset active</span>
          )}
          <div style={{ flex: 1 }} />
          <BackendStatus />
        </header>

        {/* Messages */}
        <div className="messages-viewport">
          <div className="messages-inner">
            {!hasMessages && !showUpload && !chat.preprocessResult && (
              <WelcomeScreen onAction={handleSuggestionClick} hasDataset={!!chat.fileInfo} />
            )}

            {showUpload && !chat.preprocessResult && (
              <div style={{ maxWidth: 480, margin: '32px auto' }}>
                <FileUpload
                  onFileLoaded={(file) => {
                    setShowUpload(false);
                    chat.handleUpload(file);
                  }}
                  disabled={chat.isLoading}
                />
              </div>
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
  );
}
