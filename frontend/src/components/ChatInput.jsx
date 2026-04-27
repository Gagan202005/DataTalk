import React, { useState, useRef } from 'react';
import { Send, Paperclip, Mic, MicOff } from 'lucide-react';
import ModeSelector from './ModeSelector';
import WebSearchToggle from './WebSearchToggle';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const isSpeechSupported = !!SpeechRecognition;

export default function ChatInput({
  onSend, onFileClick, disabled, placeholder,
  mode = 'auto', onModeChange,
  webSearch = false, onWebSearchChange,
}) {
  const [input, setInput]         = useState('');
  const [listening, setListening] = useState(false);
  const textareaRef  = useRef(null);
  const recognitionRef = useRef(null);

  const submit = (e) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const handleChange = (e) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  const toggleVoice = () => {
    if (!isSpeechSupported) return;
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }

    const r = new SpeechRecognition();
    r.lang = 'en-US';
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e) => { setInput(e.results[0][0].transcript); setListening(false); setTimeout(() => textareaRef.current?.focus(), 80); };
    r.onerror = () => setListening(false);
    r.onend   = () => setListening(false);
    recognitionRef.current = r;
    r.start();
    setListening(true);
  };

  return (
    <form onSubmit={submit}>
      {/* Mode selector + web search toggle row */}
      <div className="input-controls-row">
        <ModeSelector mode={mode} onChange={onModeChange} disabled={disabled} />
        <WebSearchToggle enabled={webSearch} onChange={onWebSearchChange} disabled={disabled} />
      </div>

      <div className="input-box">
        <button type="button" className="input-icon-btn" onClick={onFileClick} title="Attach file" disabled={disabled}>
          <Paperclip size={16} />
        </button>

        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Ask about your data…'}
          disabled={disabled}
          rows={1}
          className="input-textarea"
        />

        {isSpeechSupported && (
          <button
            type="button"
            className={`input-icon-btn${listening ? ' active' : ''}`}
            onClick={toggleVoice}
            disabled={disabled}
            title={listening ? 'Stop listening' : 'Voice input'}
          >
            {listening ? <MicOff size={15} /> : <Mic size={15} />}
          </button>
        )}

        <button
          type="submit"
          className="input-send-btn"
          disabled={!input.trim() || disabled}
          title="Send"
        >
          <Send size={14} />
        </button>
      </div>

      <p className="input-hint">Shift+Enter for new line · Enter to send</p>
    </form>
  );
}
