import React, { useState, useCallback } from 'react';
import { Bot, PanelLeftClose, PanelLeft } from 'lucide-react';
import FileUpload from './components/FileUpload';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import WelcomeScreen from './components/WelcomeScreen';
import Sidebar from './components/Sidebar';
import { useChat } from './hooks/useChat';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  
  const chat = useChat();

  const handleSuggestionClick = useCallback((text) => {
    if (text === 'Upload a dataset to start') {
      setShowUpload(true);
    } else {
      chat.sendMessage(text);
    }
  }, [chat]);

  const hasMessages = chat.messages.length > 0;

  return (
    <div className="h-screen flex bg-mesh overflow-hidden">
      {/* ──── Sidebar ──── */}
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

      {/* ──── Main ──── */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="glass-strong border-b border-[#2a2a4a]/40 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-xl text-[#6a6a8a] hover:text-white hover:bg-[#2a2a4a]/40 transition-all duration-200"
          >
            {sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeft size={17} />}
          </button>
          <div className="h-4 w-px bg-[#2a2a4a]" />
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-[#a78bfa]" />
            <span className="text-sm font-semibold text-white">
              {chat.fileInfo ? chat.fileInfo.name : 'New Conversation'}
            </span>
          </div>
          {chat.fileInfo && (
            <span className="ml-auto px-3 py-1 rounded-full text-[10px] font-semibold bg-[#2dd4bf]/10 text-[#2dd4bf] border border-[#2dd4bf]/20">
              Dataset Active
            </span>
          )}
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-4xl mx-auto">
            {!hasMessages && !showUpload && !chat.fileInfo && (
              <WelcomeScreen onSuggestionClick={handleSuggestionClick} />
            )}

            {(showUpload || (!chat.fileInfo && !hasMessages && showUpload)) && (
              <div className="max-w-lg mx-auto py-12">
                <FileUpload 
                  onFileLoaded={(file) => {
                    setShowUpload(false);
                    chat.handleUpload(file);
                  }} 
                  disabled={chat.isLoading} 
                />
              </div>
            )}

            {chat.messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} onSendMessage={chat.sendMessage} />
            ))}

            {chat.error && !chat.isLoading && chat.messages.length === 0 && (
                <div className="flex justify-center mb-5 anim-fade-in-up">
                  <div className="glass-card !border-red-500/30 px-5 py-3 max-w-[80%] text-center shadow-lg shadow-red-500/10">
                      <p className="text-red-400 text-sm font-medium">{chat.error}</p>
                  </div>
                </div>
            )}

            {chat.isLoading && (
              <div className="flex gap-3 mb-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-[#5b21b6]/25 to-[#2dd4bf]/15 border border-[#5b21b6]/20 flex items-center justify-center">
                  <Bot size={15} className="text-[#a78bfa]" />
                </div>
                <div className="chat-bubble-bot">
                  <div className="typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chat.messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-[#2a2a4a]/20 px-4 sm:px-6 lg:px-8 py-4">
          <div className="max-w-4xl mx-auto">
            <ChatInput
              onSend={chat.sendMessage}
              onFileClick={() => setShowUpload(true)}
              disabled={chat.isLoading}
              placeholder={chat.fileInfo ? `Ask about ${chat.fileInfo.name}...` : 'Upload a dataset or ask a question...'}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
