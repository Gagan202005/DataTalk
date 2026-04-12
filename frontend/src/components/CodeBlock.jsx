import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ChevronDown, ChevronUp, Copy, Check, Code2 } from 'lucide-react';

// Detect language from content or explicit label
function detectLanguage(code, language) {
  if (language) return language.toLowerCase();
  // Simple heuristics
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)\b/i.test(code.trim())) return 'sql';
  if (/^\s*(import |from |def |class |print\(|if __name__)/m.test(code)) return 'python';
  if (/^\s*(const |let |var |function |=>|import )/m.test(code)) return 'javascript';
  return 'sql'; // default for data analysis context
}

const languageLabels = {
  sql: 'SQL',
  python: 'Python',
  javascript: 'JavaScript',
  js: 'JavaScript',
};

const languageColors = {
  sql: '#3b82f6',
  python: '#f59e0b',
  javascript: '#10b981',
  js: '#10b981',
};

// Custom dark theme matching our NatWest-inspired palette
const customTheme = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    background: '#0f0f1e',
    margin: 0,
    padding: '12px 14px',
    fontSize: '12px',
    lineHeight: '1.6',
    fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
    borderRadius: 0,
  },
  'code[class*="language-"]': {
    ...oneDark['code[class*="language-"]'],
    background: 'none',
    fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
    fontSize: '12px',
  },
};

export default function CodeBlock({ code, language, title }) {
  const [collapsed, setCollapsed] = useState(true);
  const [copied, setCopied] = useState(false);

  if (!code || !code.trim()) return null;

  const lang = detectLanguage(code, language);
  const langLabel = languageLabels[lang] || lang.toUpperCase();
  const langColor = languageColors[lang] || '#8b5cf6';
  const lines = code.trim().split('\n');
  const isLong = lines.length > 3;
  const displayCode = collapsed && isLong ? lines.slice(0, 3).join('\n') : code.trim();

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = code.trim();
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-[rgba(255,255,255,0.08)] bg-[#111827]/60 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[rgba(255,255,255,0.02)] border-b border-[rgba(255,255,255,0.06)]">
        <Code2 size={13} style={{ color: langColor }} />
        <span className="text-[11px] font-semibold" style={{ color: langColor }}>
          {title || langLabel}
        </span>

        {/* Line count */}
        <span className="text-[10px] text-[#64748b] ml-1">
          {lines.length} line{lines.length !== 1 ? 's' : ''}
        </span>

        <div className="ml-auto flex items-center gap-1">
          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all duration-200 hover:bg-[rgba(255,255,255,0.06)]"
            style={{ color: copied ? '#10b981' : '#64748b' }}
            title="Copy code"
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>

          {/* Collapse toggle */}
          {isLong && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-[#64748b] hover:bg-[rgba(255,255,255,0.06)] transition-all duration-200"
            >
              {collapsed ? (
                <><ChevronDown size={11} /> Expand</>
              ) : (
                <><ChevronUp size={11} /> Collapse</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Code */}
      <div className="relative">
        <SyntaxHighlighter
          language={lang}
          style={customTheme}
          showLineNumbers={!collapsed || !isLong}
          lineNumberStyle={{ color: '#3a3a5a', fontSize: '10px', paddingRight: '12px', minWidth: '2em' }}
          wrapLines
        >
          {displayCode}
        </SyntaxHighlighter>

        {/* Fade-out gradient when collapsed */}
        {collapsed && isLong && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#0f0f1e] to-transparent pointer-events-none" />
        )}
      </div>
    </div>
  );
}
