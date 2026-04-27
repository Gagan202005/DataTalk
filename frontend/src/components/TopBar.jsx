import React from 'react';
import { PanelLeftClose, PanelLeft, BarChart2, Download, FlaskConical, ShieldCheck, ShieldAlert, Globe, Shield, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';

export default function TopBar({
  sidebarOpen,
  onToggleSidebar,
  tables = {},
  sessionId,
  onExportPDF,
  onOpenModelLab,
  onOpenGlobe,
  onOpenCompliance,
  complianceStatus,
}) {
  const { theme, toggleTheme } = useTheme();
  const tableNames   = Object.keys(tables);
  const hasData      = tableNames.length > 0;
  const firstName    = hasData ? Object.values(tables)[0].filename : null;
  const complianceCls = complianceStatus === 'blocked' ? 'blocked' : complianceStatus === 'warning' ? 'warning' : 'ok';

  return (
    <header className="topbar">
      <button
        className="topbar-btn"
        onClick={onToggleSidebar}
        title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
      </button>

      <div className="topbar-divider" />

      <div className="topbar-logo">
        <BarChart2 size={16} />
        <span>DataTalk</span>
      </div>

      {hasData && (
        <>
          <div className="topbar-divider" />
          <div className="topbar-dataset-badge">
            {firstName}
            {tableNames.length > 1 && <span style={{ opacity: 0.6 }}>+{tableNames.length - 1}</span>}
          </div>
        </>
      )}

      <div style={{ flex: 1 }} />

      {/* Compliance shield — only when data loaded */}
      {hasData && (
        <div
          className={`compliance-shield ${complianceCls}`}
          title={
            complianceStatus === 'blocked'  ? 'Compliance: blocked query' :
            complianceStatus === 'warning'  ? 'Compliance: warnings detected' :
                                              'Compliance: all clear'
          }
        >
          {complianceStatus === 'warning' || complianceStatus === 'blocked'
            ? <ShieldAlert size={14} />
            : <ShieldCheck size={14} />}
        </div>
      )}


      {/* Financial Globe button */}
      <button
        className="topbar-btn"
        onClick={onOpenGlobe}
        title="Open Financial Globe"
      >
        <Globe size={14} />
        <span>Globe</span>
      </button>

      {/* Compliance button */}
      <button
        className="topbar-btn"
        onClick={onOpenCompliance}
        title="RBI Compliance Guidelines"
      >
        <Shield size={14} />
        <span>Compliance</span>
      </button>

      {/* Model Lab button */}
      <button
        className="topbar-btn topbar-model-btn"
        onClick={onOpenModelLab}
        title="Secure Model Lab — run models privately in your environment"
        disabled={!hasData}
      >
        <FlaskConical size={14} />
        <span>Secure Model Lab</span>
      </button>

      {/* Theme toggle */}
      <button
        className="topbar-btn"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
      </button>

      {/* Export PDF */}
      <button
        className="topbar-btn"
        onClick={onExportPDF}
        title="Export PDF report"
        disabled={!hasData}
      >
        <Download size={14} />
      </button>
    </header>
  );
}
