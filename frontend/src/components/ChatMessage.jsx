import React from 'react';
import ReactMarkdown from 'react-markdown';
import { User, Bot, FileSpreadsheet, Terminal, CheckCircle2, AlertCircle, Clock, Cpu } from 'lucide-react';
import DataSummary from './DataSummary';
import ChartRenderer from './ChartRenderer';
import ConfidenceScore from './ConfidenceScore';
import CodeBlock from './CodeBlock';

export default function ChatMessage({ message, onSendMessage }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isError = message.isError;

  // Format timestamp
  const timeStr = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  // System messages
  if (isSystem) {
    return (
      <div className="flex justify-center mb-5 animate-fade-in-up">
        <div className="glass-card px-5 py-3 max-w-[80%] text-center">
          <MarkdownContent content={message.content} />
        </div>
      </div>
    );
  }

  // User messages
  if (isUser) {
    return (
      <div className="flex gap-3 justify-end mb-5">
        <div>
          {message.type === 'file-upload' && message.fileData ? (
            <div className="chat-bubble-user mb-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={15} />
                <span className="text-sm font-semibold">{message.content}</span>
              </div>
            </div>
          ) : (
            <div className="chat-bubble-user">
              <p className="text-sm leading-relaxed">{message.content}</p>
            </div>
          )}
          {timeStr && <p className="text-[10px] text-[#4a4a6a] text-right mt-1">{timeStr}</p>}
        </div>
        <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-[#5b21b6] to-[#7c3aed] flex items-center justify-center mt-1 shadow-lg shadow-[#5b21b6]/25">
          <User size={15} className="text-white" />
        </div>
      </div>
    );
  }

  // ──── AI / Assistant messages ────
  const agentLabel = message.agent_used || message.fnName || 'DataTalk AI';
  const hasCode = message.sql_query || message.python_code;
  const hasChart = message.chart || message.matplotlib_image;
  const hasConfidence = message.confidence;
  const hasSources = message.sources && message.sources.length > 0;

  return (
    <div className="flex gap-3 justify-start mb-5">
      {/* Bot Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-[#5b21b6]/25 to-[#2dd4bf]/15 border border-[#5b21b6]/20 flex items-center justify-center mt-1">
        <Bot size={15} className="text-[#a78bfa]" />
      </div>

      <div className="max-w-[82%] min-w-0">
        {/* File upload data summary */}
        {message.type === 'file-upload' && message.fileData && (
          <div className="chat-bubble-bot mb-3">
            <DataSummary data={message.fileData} />
          </div>
        )}

        {/* Function-call styled response block */}
        <div className={`fn-call-block anim-scale-in ${isError ? '!border-[#ef4444]/30' : ''}`}>
          {/* Header: agent + function name */}
          <div className={`fn-call-header ${isError ? '!bg-[#ef4444]/8 !text-[#ef4444]' : ''}`}>
            {isError ? <AlertCircle size={13} /> : <Terminal size={13} />}
            <span>{isError ? 'error' : agentLabel}()</span>
            {timeStr && (
              <span className="ml-auto flex items-center gap-1 text-[10px] text-[#6a6a8a] font-normal">
                <Clock size={9} />
                {timeStr}
              </span>
            )}
          </div>

          {/* Function args (if present) */}
          {message.fnArgs && (
            <div className="fn-call-body">
              <pre className="whitespace-pre-wrap text-[#8a8aaa]">{message.fnArgs}</pre>
            </div>
          )}

          {/* Result section */}
          <div className={`fn-call-result ${isError ? '!bg-[#ef4444]/4' : ''}`}>
            <div className={`result-label ${isError ? '!text-[#ef4444]' : ''}`}>
              {isError ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
              {isError ? 'Error' : 'Result'}
            </div>

            {/* Main text answer */}
            <div className="prose prose-sm prose-invert max-w-none">
              <MarkdownContent content={message.content} />
            </div>

            {/* Raw data table (shown when summary is blocked for sensitive data) */}
            {message.data && message.data.length > 0 && (
              <DataTable data={message.data} />
            )}

            {/* SQL Query (collapsible) */}
            {message.sql_query && (
              <CodeBlock code={message.sql_query} language="sql" title="SQL Query" />
            )}

            {/* Chart */}
            {hasChart && (
              <ChartRenderer
                chart={message.chart}
                matplotlib_image={message.matplotlib_image}
                onExplain={message.matplotlib_image && onSendMessage
                  ? () => onSendMessage('Explain this figure in detail — describe the key patterns, trends, and insights visible in the chart.')
                  : undefined}
              />
            )}

            {/* Confidence Score */}
            {hasConfidence && (
              <ConfidenceScore confidence={message.confidence} />
            )}

            {/* Sources */}
            {hasSources && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold text-[#64748b] mr-1">📎 Sources:</span>
                {message.sources.map((src, i) => {
                  if (typeof src === 'object' && src.url) {
                    return (
                      <a
                        key={i}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[rgba(59,130,246,0.1)] text-[#60a5fa] border border-[rgba(59,130,246,0.15)] hover:bg-[rgba(59,130,246,0.2)]"
                        title={src.snippet}
                      >
                        🌐 {src.title || src.name || `Web Source ${i + 1}`}
                      </a>
                    );
                  }
                  return (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[rgba(139,92,246,0.1)] text-[#a78bfa] border border-[rgba(139,92,246,0.15)]"
                    >
                      {typeof src === 'string' ? src : src.name || src.column || `Source ${i + 1}`}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Follow-up suggestions — clicking auto-submits the question */}
            {message.suggestions && message.suggestions.length > 0 && (
              <div className="mt-4 pt-3 border-t border-[rgba(255,255,255,0.05)]">
                <p className="text-[10px] font-semibold text-[#64748b] mb-2">💡 You might also ask:</p>
                <div className="flex flex-wrap gap-2">
                  {message.suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => onSendMessage && onSendMessage(s)}
                      className="px-3 py-1.5 rounded-full text-[11px] font-medium bg-[#8b5cf6]/8 text-[#a78bfa] border border-[#8b5cf6]/20 hover:bg-[#8b5cf6]/20 hover:border-[#8b5cf6]/40 transition-all duration-200 text-left"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──── Shared Markdown Renderer ──── */
function MarkdownContent({ content }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => (
          <p className="text-[13px] leading-relaxed mb-2 last:mb-0 text-[#ddd] font-[Inter,sans-serif]">{children}</p>
        ),
        strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
        em: ({ children }) => <em className="text-[#a0a0c0] italic">{children}</em>,
        code: ({ children, className }) => {
          if (!className) {
            return (
              <code className="px-1.5 py-0.5 rounded bg-[#2a2a4a]/60 text-[#a78bfa] text-[11px] font-mono">
                {children}
              </code>
            );
          }
          return (
            <pre className="bg-[#0f0f1e] rounded-lg p-3 overflow-x-auto my-2 border border-[#2a2a4a]/50">
              <code className="text-[11px] text-[#c8c8e0] font-mono">{children}</code>
            </pre>
          );
        },
        ul: ({ children }) => (
          <ul className="list-disc list-inside space-y-1 my-2 text-[13px] text-[#c8c8e0]">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside space-y-1 my-2 text-[13px] text-[#c8c8e0]">{children}</ol>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-2 rounded-lg border border-[#2a2a4a]/50">
            <table className="data-table">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="!bg-[#1a1a2e] !text-[#a0a0c0]">{children}</th>,
        td: ({ children }) => <td className="!text-[#c8c8e0]">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

/* ──── Raw Data Table ──── */
function DataTable({ data }) {
  if (!data || data.length === 0) return null;
  const headers = Object.keys(data[0]);
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-[#2a2a4a]/50">
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="bg-[#1a1a2e]">
            {headers.map(h => (
              <th key={h} className="px-3 py-2 text-left text-[#a0a0c0] font-semibold border-b border-[#2a2a4a]/50 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 100).map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-[#0f0f1e]/60' : 'bg-[#16162a]/40'}>
              {headers.map(h => (
                <td key={h} className="px-3 py-1.5 text-[#c8c8e0] border-b border-[#2a2a4a]/30 whitespace-nowrap">
                  {row[h] === null || row[h] === undefined
                    ? <span className="text-[#4a4a6a] italic">null</span>
                    : String(row[h])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 100 && (
        <p className="text-[10px] text-[#6a6a8a] text-center py-1.5 border-t border-[#2a2a4a]/30">
          Showing 100 of {data.length} rows
        </p>
      )}
    </div>
  );
}
