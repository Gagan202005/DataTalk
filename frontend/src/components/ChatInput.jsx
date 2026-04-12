import React, { useState, useRef } from 'react';
import { Send, Paperclip, Sparkles, Mic, MicOff } from 'lucide-react';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const isSpeechSupported = !!SpeechRecognition;

export default function ChatInput({ onSend, onFileClick, disabled, placeholder }) {
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInput = (e) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  };

  const toggleVoice = () => {
    if (!isSpeechSupported) return;

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      setListening(false);
      // Focus textarea so user can review/edit before pressing Enter
      setTimeout(() => textareaRef.current?.focus(), 100);
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="glass-strong rounded-2xl flex items-end gap-2 px-4 py-3 transition-all duration-200 focus-within:border-[#5b21b6]/50 focus-within:shadow-lg focus-within:shadow-[#5b21b6]/5">
        {/* File Attach */}
        <button
          type="button"
          onClick={onFileClick}
          className="flex-shrink-0 p-2 rounded-xl text-[#6a6a8a] hover:text-[#a78bfa] hover:bg-[#5b21b6]/10 transition-all duration-200 mb-0.5"
          title="Upload file"
        >
          <Paperclip size={17} />
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Ask about your data..."}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-[#e0e0f0] placeholder:text-[#5a5a7a] max-h-[140px] py-1.5 leading-relaxed disabled:opacity-40"
        />

        {/* Mic — only shown if browser supports Speech Recognition */}
        {isSpeechSupported && (
          <button
            type="button"
            onClick={toggleVoice}
            disabled={disabled}
            title={listening ? 'Stop listening' : 'Speak your question'}
            className={`flex-shrink-0 p-2 rounded-xl transition-all duration-200 mb-0.5 ${
              listening
                ? 'text-[#ef4444] bg-[#ef4444]/10 animate-pulse'
                : 'text-[#6a6a8a] hover:text-[#a78bfa] hover:bg-[#5b21b6]/10'
            }`}
          >
            {listening ? <MicOff size={17} /> : <Mic size={17} />}
          </button>
        )}

        {/* Send */}
        <button
          type="submit"
          disabled={!input.trim() || disabled}
          className={`flex-shrink-0 p-2.5 rounded-xl transition-all duration-200 mb-0.5 ${
            input.trim() && !disabled
              ? 'bg-gradient-to-r from-[#5b21b6] to-[#7c3aed] text-white shadow-lg shadow-[#5b21b6]/25 hover:shadow-[#5b21b6]/45 hover:scale-105 active:scale-95'
              : 'text-[#3a3a5a] cursor-not-allowed'
          }`}
        >
          <Send size={15} />
        </button>
      </div>

      <p className="text-center mt-2 text-[10px] text-[#4a4a6a]">
        <Sparkles size={9} className="inline mr-1 text-[#5b21b6]" />
        DataTalk analyzes your uploaded datasets and generates insights via function calls
      </p>
    </form>
  );
}
