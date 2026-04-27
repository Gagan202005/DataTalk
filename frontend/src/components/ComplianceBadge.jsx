import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, ChevronDown, ChevronUp } from 'lucide-react';

const STATUS_CONFIG = {
  compliant: { icon: ShieldCheck, label: 'Compliant',   cls: 'compliant' },
  warning:   { icon: ShieldAlert,  label: 'Warning',     cls: 'warning'   },
  blocked:   { icon: ShieldX,      label: 'Blocked',     cls: 'blocked'   },
};

export default function ComplianceBadge({ compliance }) {
  const [expanded, setExpanded] = useState(false);
  if (!compliance) return null;

  const status = compliance.status || 'compliant';
  const cfg    = STATUS_CONFIG[status] || STATUS_CONFIG.compliant;
  const Icon   = cfg.icon;
  const annotations = compliance.annotations || [];

  return (
    <div className={`compliance-badge ${cfg.cls}`}>
      <div
        className="compliance-badge-header"
        onClick={() => annotations.length > 0 && setExpanded(v => !v)}
        style={{ cursor: annotations.length > 0 ? 'pointer' : 'default' }}
      >
        <Icon size={12} />
        <span>{cfg.label}</span>
        {annotations.length > 0 && (
          <>
            <span className="compliance-badge-count">{annotations.length} rule{annotations.length !== 1 ? 's' : ''}</span>
            {expanded ? <ChevronUp size={11} style={{ marginLeft: 'auto' }} /> : <ChevronDown size={11} style={{ marginLeft: 'auto' }} />}
          </>
        )}
      </div>

      {expanded && annotations.length > 0 && (
        <div className="compliance-badge-annotations">
          {annotations.map((ann, i) => (
            <div key={i} className={`compliance-annotation ${ann.status || 'warning'}`}>
              <div className="compliance-annotation-rule">{ann.rule}</div>
              <div className="compliance-annotation-msg">{ann.message}</div>
              {ann.affected_rows > 0 && (
                <div className="compliance-annotation-rows">{ann.affected_rows.toLocaleString()} affected rows</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
