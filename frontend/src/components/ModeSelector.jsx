import React from 'react';
import { Zap, Database, BarChart2, Shield } from 'lucide-react';

const MODES = [
  { id: 'auto',       label: 'Auto',       icon: Zap,      title: 'Let AI decide the best approach' },
  { id: 'sql',        label: 'SQL',        icon: Database, title: 'Force SQL query mode' },
  { id: 'analysis',   label: 'Advanced',   icon: BarChart2,title: 'Statistical analysis & Python charts' },
  { id: 'compliance', label: 'Compliance', icon: Shield,   title: 'Compliance & regulatory Q&A' },
];

export default function ModeSelector({ mode = 'auto', onChange, disabled }) {
  return (
    <div className="mode-selector">
      {MODES.map(({ id, label, icon: Icon, title }) => (
        <button
          key={id}
          className={`mode-pill${mode === id ? ' active' : ''}`}
          onClick={() => onChange && onChange(id)}
          disabled={disabled}
          title={title}
          type="button"
        >
          <Icon size={11} />
          {label}
        </button>
      ))}
    </div>
  );
}
