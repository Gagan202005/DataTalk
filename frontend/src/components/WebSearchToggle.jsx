import React from 'react';
import { Globe } from 'lucide-react';

export default function WebSearchToggle({ enabled = false, onChange, disabled }) {
  return (
    <button
      type="button"
      className={`web-search-toggle${enabled ? ' active' : ''}`}
      onClick={() => onChange && onChange(!enabled)}
      disabled={disabled}
      title={enabled ? 'Web search ON — responses include live market context' : 'Enable web search for live market context'}
    >
      <Globe size={12} />
      <span>Web</span>
      <span className="toggle-track">
        <span className={`toggle-thumb${enabled ? ' on' : ''}`} />
      </span>
    </button>
  );
}
