import React, { useState } from 'react';
import { Globe, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

export default function WebContextCard({ results = [] }) {
  const [open, setOpen] = useState(false);
  if (!results || results.length === 0) return null;

  return (
    <div className="web-context-card">
      <button
        className="web-context-header"
        onClick={() => setOpen(v => !v)}
        type="button"
      >
        <Globe size={13} />
        <span>Market Context</span>
        <span className="web-context-count">{results.length} source{results.length !== 1 ? 's' : ''}</span>
        {open ? <ChevronUp size={12} style={{ marginLeft: 'auto' }} /> : <ChevronDown size={12} style={{ marginLeft: 'auto' }} />}
      </button>

      {open && (
        <div className="web-context-body">
          {results.map((r, i) => (
            <div key={i} className="web-context-item">
              <div className="web-context-item-title">
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noopener noreferrer">
                    {r.title || `Source ${i + 1}`}
                    <ExternalLink size={10} style={{ marginLeft: 4, opacity: 0.6 }} />
                  </a>
                ) : (
                  <span>{r.title || `Source ${i + 1}`}</span>
                )}
              </div>
              {r.snippet && <p className="web-context-item-snippet">{r.snippet}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
