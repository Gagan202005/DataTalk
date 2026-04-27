import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Database, FileSpreadsheet, Copy, Check, AlertCircle, ChevronRight, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';
import DataSummary from './DataSummary';
import ChartRenderer from './ChartRenderer';
import ConfidenceScore from './ConfidenceScore';
import ComplianceBadge from './ComplianceBadge';
import WebContextCard from './WebContextCard';

export default function ChatMessage({ message, onSendMessage }) {
  const isUser   = message.role === 'user';
  const isSystem = message.role === 'system';
  const isError  = message.isError;

  const timeStr = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  /* ── System / upload confirmation ── */
  if (isSystem) {
    return (
      <div className="msg-system">
        <div className="msg-system-card">
          <MarkdownContent content={message.content} />

          {message.anomalies && message.anomalies.length > 0 && (
            <div className="info-card anomaly-card" style={{ textAlign: 'left' }}>
              <div className="info-card-label">{message.anomalies.length} anomaly group{message.anomalies.length > 1 ? 's' : ''} detected</div>
              {message.anomalies.map((a, i) => (
                <div key={i} className="anomaly-row">
                  <span className="anomaly-msg">{a.message}</span>
                  <span className="anomaly-count">{a.count} rows</span>
                </div>
              ))}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                {message.anomalies.map((a, i) => (
                  <button
                    key={i}
                    className="anomaly-investigate-btn"
                    onClick={() => onSendMessage && onSendMessage(`Show me suspicious values in the '${a.column}' column`)}
                  >
                    Investigate {a.column}
                  </button>
                ))}
              </div>
            </div>
          )}

          {message.starterQuestions && message.starterQuestions.length > 0 && (
            <div className="info-card starter-card" style={{ textAlign: 'left', marginTop: 10 }}>
              <div className="info-card-label">Suggested questions</div>
              <div className="starter-questions-grid">
                {message.starterQuestions.map((q, i) => (
                  <button key={i} className="starter-question-btn" onClick={() => onSendMessage && onSendMessage(q)}>
                    <ChevronRight size={11} style={{ flexShrink: 0, opacity: 0.5 }} />
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── User message ── */
  if (isUser) {
    return (
      <div className="msg-user">
        <div>
          {message.type === 'file-upload' ? (
            <div className="msg-user-bubble" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <FileSpreadsheet size={14} />
              <span style={{ fontSize: 13 }}>{message.content}</span>
            </div>
          ) : (
            <div className="msg-user-bubble">{message.content}</div>
          )}
          {timeStr && <div className="msg-user-meta">{timeStr}</div>}
        </div>
      </div>
    );
  }

  /* ── AI / assistant message ── */
  const AGENT_MAP = {
    sql_agent:         { label: 'SQL',        cls: 'sql'        },
    code_agent:        { label: 'Analysis',   cls: 'code'       },
    search_agent:      { label: 'Web Search', cls: 'search'     },
    general:           { label: 'DataTalk',   cls: 'general'    },
    compliance_agent:  { label: 'Compliance', cls: 'compliance' },
  };
  const agentInfo = AGENT_MAP[message.agent_used] || { label: 'DataTalk', cls: 'general' };
  const hasChart  = message.chart || message.matplotlib_image;

  return (
    <div className="msg-ai">
      <div className="msg-ai-avatar">
        <Database size={13} />
      </div>

      <div className="msg-ai-body">
        {/* Header row */}
        <div className="msg-ai-header">
          <span className="msg-ai-name">DataTalk</span>
          {!isError && message.agent_used && (
            <span className={`agent-badge ${agentInfo.cls}`}>{agentInfo.label}</span>
          )}
          {timeStr && <span className="msg-ai-time" style={{ marginLeft: isError ? 'auto' : undefined }}>{timeStr}</span>}
          {isError && <AlertCircle size={12} style={{ color: 'var(--error)', marginLeft: 'auto' }} />}
        </div>

        {/* Rich card wrapper */}
        <div className="msg-ai-card">
          {/* Main text answer */}
          <div className={`card-section${isError ? ' is-error' : ''}`}>
            <div className="card-section-body">
              <MarkdownContent content={message.content} />
            </div>
          </div>

          {/* SQL block */}
          {message.sql_query && (
            <CollapsibleSection label="SQL Query" defaultOpen={false}>
              <SQLBlock code={message.sql_query} />
            </CollapsibleSection>
          )}

          {/* Python code */}
          {message.python_code && (
            <CollapsibleSection label="Python Code" defaultOpen={false}>
              <div className="code-block">
                <div className="code-block-header"><span>Python</span></div>
                <pre className="code-block-body"><code>{message.python_code}</code></pre>
              </div>
            </CollapsibleSection>
          )}

          {/* Data table */}
          {message.data && message.data.length > 0 && (
            <CollapsibleSection label={`Results — ${message.data.length} rows`} defaultOpen>
              <DataTable data={message.data} />
            </CollapsibleSection>
          )}

          {/* Chart */}
          {hasChart && (
            <CollapsibleSection label="Chart" defaultOpen>
              <ChartRenderer
                chart={message.chart}
                matplotlib_image={message.matplotlib_image}
                onExplain={onSendMessage
                  ? () => {
                      if (message.chart?.data) {
                        const sample = JSON.stringify(message.chart.data.slice(0, 10));
                        onSendMessage(`Explain this chart in detail — describe the key patterns, trends, and insights. Chart data: ${sample}`);
                      } else {
                        onSendMessage('Explain this chart in detail — describe the key patterns, trends, and insights.');
                      }
                    }
                  : undefined}
              />
            </CollapsibleSection>
          )}

          {/* Web context */}
          {message.web_context && message.web_context.length > 0 && (
            <div className="card-section">
              <div className="card-section-body">
                <WebContextCard results={message.web_context} />
              </div>
            </div>
          )}

          {/* Compliance */}
          {message.compliance && (
            <div className="card-section">
              <div className="card-section-body">
                <ComplianceBadge compliance={message.compliance} />
              </div>
            </div>
          )}

          {/* Confidence */}
          {message.confidence && (
            <div className="card-section">
              <div className="card-section-body">
                <ConfidenceScore confidence={message.confidence} />
              </div>
            </div>
          )}

          {/* Sources */}
          {message.sources && message.sources.length > 0 && (
            <div className="card-section">
              <div className="card-section-body">
                <div className="sources-row">
                  <span className="source-label">Sources</span>
                  {message.sources.map((src, i) => {
                    if (typeof src === 'object' && src.url) {
                      return (
                        <a key={i} href={src.url} target="_blank" rel="noopener noreferrer" className="source-pill" title={src.snippet}>
                          {src.title || src.name || `Source ${i + 1}`}
                        </a>
                      );
                    }
                    return (
                      <span key={i} className="source-pill">
                        {typeof src === 'string' ? src : src.name || src.column || `Source ${i + 1}`}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Follow-up suggestions */}
          {message.suggestions && message.suggestions.length > 0 && (
            <div className="card-section">
              <div className="card-section-body">
                <div className="suggestion-strip">
                  {message.suggestions.map((s, i) => (
                    <button key={i} className="suggestion-chip" onClick={() => onSendMessage && onSendMessage(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Collapsible section ── */
function CollapsibleSection({ label, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card-section">
      <button className="card-section-header" onClick={() => setOpen(v => !v)} type="button">
        <span>{label}</span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && <div className="card-section-body">{children}</div>}
    </div>
  );
}

/* ── Markdown renderer ── */
function MarkdownContent({ content }) {
  return (
    <ReactMarkdown
      components={{
        p:      ({ children }) => <p>{children}</p>,
        strong: ({ children }) => <strong>{children}</strong>,
        em:     ({ children }) => <em>{children}</em>,
        ul:     ({ children }) => <ul>{children}</ul>,
        ol:     ({ children }) => <ol>{children}</ol>,
        li:     ({ children }) => <li>{children}</li>,
        code: ({ children, className }) => {
          if (className) return <pre><code>{children}</code></pre>;
          return <code>{children}</code>;
        },
        table: ({ children }) => (
          <div className="data-table-wrap" style={{ marginTop: 8 }}>
            <table className="data-table">{children}</table>
          </div>
        ),
        th: ({ children }) => <th>{children}</th>,
        td: ({ children }) => <td>{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

/* ── SQL block with copy button ── */
function SQLBlock({ code }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <div className="code-block">
      <div className="code-block-header">
        <span>SQL</span>
        <button className="code-block-copy" onClick={copy}>
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? ' Copied' : ' Copy'}
        </button>
      </div>
      <pre className="code-block-body"><code>{code}</code></pre>
    </div>
  );
}

/* ── Raw data table ── */
function DataTable({ data }) {
  if (!data || data.length === 0) return null;
  const headers = Object.keys(data[0]);
  return (
    <div className="data-table-wrap" style={{ maxHeight: 280, overflowY: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>{headers.map(h => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {data.slice(0, 100).map((row, i) => (
            <tr key={i}>
              {headers.map(h => (
                <td key={h}>
                  {row[h] === null || row[h] === undefined
                    ? <span style={{ color: 'var(--text-xmuted)', fontStyle: 'italic' }}>null</span>
                    : String(row[h])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 100 && (
        <div style={{ padding: '6px 12px', fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
          Showing 100 of {data.length} rows
        </div>
      )}
    </div>
  );
}
