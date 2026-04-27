import React from 'react';

export default function StatusBar({ sessionId, tables = {}, modelName = 'Gemini 2.5 Flash' }) {
  const tableCount = Object.keys(tables).length;
  const totalRows  = Object.values(tables).reduce((sum, t) => sum + (t.rowCount || 0), 0);
  const shortId    = sessionId ? sessionId.slice(0, 8) : '—';

  return (
    <div className="statusbar">
      <span className="statusbar-item">Session: <code>{shortId}</code></span>
      <span className="statusbar-sep">·</span>
      <span className="statusbar-item">{tableCount} table{tableCount !== 1 ? 's' : ''} loaded</span>
      {totalRows > 0 && (
        <>
          <span className="statusbar-sep">·</span>
          <span className="statusbar-item">{totalRows.toLocaleString()} rows</span>
        </>
      )}
      <span className="statusbar-sep">·</span>
      <span className="statusbar-item statusbar-model">{modelName}</span>
    </div>
  );
}
