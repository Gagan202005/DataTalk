import React, { useState } from 'react';
import { Plus, Trash2, Database, Sparkles, FileSpreadsheet, Download, Lock, Layers, Edit3 } from 'lucide-react';
import SemanticLayerEditor from './SemanticLayerEditor';

export default function Sidebar({ isOpen, fileData, onNewChat, onClearDataset, onExportPDF, semanticLayer, onUpdateSemanticLayer, sessionId, schema, dataQuality, sensitiveColumns = [], onUpdateSensitiveColumns }) {
  const [showEditor, setShowEditor] = useState(false);

  const handleSaveSemanticLayer = async (metrics) => {
    if (onUpdateSemanticLayer) onUpdateSemanticLayer(metrics);
    // In backend mode: await api.saveSemanticLayer(sessionId, metrics);
  };

  return (
    <>
      <aside
        className={`flex-shrink-0 glass-strong border-r border-[#2a2a4a]/40 flex flex-col transition-all duration-300 ease-in-out ${
          isOpen ? 'w-[260px]' : 'w-0 overflow-hidden'
        }`}
      >
        {/* ── Header ── */}
        <div className="p-4 border-b border-[#2a2a4a]/40">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#5b21b6]/25 to-[#2dd4bf]/15 border border-[#5b21b6]/20 flex items-center justify-center">
              <Sparkles size={17} className="text-[#a78bfa]" />
            </div>
            <div>
              <h1 className="text-sm font-bold gradient-text">DataTalk</h1>
              <p className="text-[10px] text-[#6a6a8a]">AI Data Analyst</p>
            </div>
          </div>
          <button
            onClick={onNewChat}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#5b21b6]/10 border border-[#5b21b6]/20 text-[#a78bfa] text-xs font-semibold hover:bg-[#5b21b6]/18 hover:border-[#5b21b6]/30 transition-all duration-200"
          >
            <Plus size={15} />
            New Chat
          </button>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {fileData ? (
            <>
              {/* File Info */}
              <div className="anim-fade-in">
                <p className="text-[10px] font-bold text-[#6a6a8a] uppercase tracking-wider mb-2">Active Dataset</p>
                <div className="rounded-xl bg-[#16162a]/60 border border-[#2a2a4a]/30 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Database size={13} className="text-[#2dd4bf]" />
                    <span className="text-xs font-semibold text-white truncate">{fileData.name || fileData.fileName}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    <div className="bg-[#0f0f1e]/60 rounded-lg px-2 py-1.5 text-center">
                      <p className="text-[#6a6a8a]">Rows</p>
                      <p className="text-white font-bold">{((fileData.rows || fileData.rowCount) || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-[#0f0f1e]/60 rounded-lg px-2 py-1.5 text-center">
                      <p className="text-[#6a6a8a]">Cols</p>
                      <p className="text-white font-bold">{fileData.columns || fileData.colCount || 0}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(schema || []).map(c => c.name).slice(0, 5).map(h => (
                      <span key={h} className="px-1.5 py-0.5 rounded text-[9px] bg-[#2a2a4a]/40 text-[#6a6a8a] truncate max-w-[80px]">{h}</span>
                    ))}
                    {(schema || []).length > 5 && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#2a2a4a]/40 text-[#5a5a7a]">+{schema.length - 5}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="anim-fade-in" style={{ animationDelay: '0.05s' }}>
                <p className="text-[10px] font-bold text-[#6a6a8a] uppercase tracking-wider mb-2">Data Quality</p>
                <div className="rounded-xl bg-[#16162a]/60 border border-[#2a2a4a]/30 p-3">
                  {(() => {
                    const nullCount = (schema || []).filter(c => c.missing_pct > 0).length;
                    const score = dataQuality?.overall_score ?? 100;
                    const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
                    return (
                      <>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] text-[#a0a0c0]">Overall Score</span>
                          <span className="text-[11px] font-bold" style={{ color }}>{score}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${score}%`, backgroundColor: color }}
                          />
                        </div>
                        {nullCount > 0 && (
                          <p className="text-[10px] text-[#f59e0b] mt-2">⚠ {nullCount} column{nullCount > 1 ? 's' : ''} with missing values</p>
                        )}
                        {nullCount === 0 && (
                          <p className="text-[10px] text-[#10b981] mt-2">✓ No missing values found</p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Sensitive Columns */}
              <div className="anim-fade-in" style={{ animationDelay: '0.07s' }}>
                <p className="text-[10px] font-bold text-[#6a6a8a] uppercase tracking-wider mb-2">Sensitive Data</p>
                <div className="rounded-xl bg-[#16162a]/60 border border-[#2a2a4a]/30 p-3 max-h-32 overflow-y-auto custom-scrollbar">
                  <p className="text-[9px] text-[#6a6a8a] mb-2 leading-relaxed">
                    Click to mark columns as sensitive.
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(schema || []).map(c => {
                      const isSensitive = sensitiveColumns.includes(c.name);
                      return (
                        <button
                          key={c.name}
                          onClick={() => {
                            if (onUpdateSensitiveColumns) {
                              onUpdateSensitiveColumns(
                                isSensitive 
                                  ? sensitiveColumns.filter(name => name !== c.name)
                                  : [...sensitiveColumns, c.name]
                              )
                            }
                          }}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${
                            isSensitive 
                              ? 'bg-red-500/20 text-red-500 border border-red-500/30'
                              : 'bg-[#2a2a4a]/40 text-[#6a6a8a] hover:bg-[#2a2a4a]/80 border border-transparent'
                          }`}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Semantic Layer */}
              <div className="anim-fade-in" style={{ animationDelay: '0.1s' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-[#6a6a8a] uppercase tracking-wider">Semantic Layer</p>
                  <button
                    onClick={() => setShowEditor(true)}
                    className="flex items-center gap-1 text-[10px] text-[#a78bfa] hover:text-white transition-colors"
                  >
                    <Edit3 size={10} />
                    Edit
                  </button>
                </div>
                <div className="rounded-xl bg-[#16162a]/60 border border-[#2a2a4a]/30 p-3">
                  {semanticLayer && semanticLayer.length > 0 ? (
                    <div className="space-y-1.5">
                      {semanticLayer.slice(0, 4).map((m, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Layers size={10} className="text-[#8b5cf6] flex-shrink-0" />
                          <span className="text-[10px] text-white font-medium truncate">{m.name}</span>
                          <span className="text-[9px] text-[#4a4a6a] ml-auto truncate max-w-[80px] font-mono">{m.expression}</span>
                        </div>
                      ))}
                      {semanticLayer.length > 4 && (
                        <p className="text-[9px] text-[#4a4a6a] text-center">+{semanticLayer.length - 4} more</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[10px] text-[#4a4a6a] text-center py-1">No metrics defined</p>
                  )}
                </div>
              </div>

              {/* Clear Dataset */}
              <button
                onClick={onClearDataset}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] text-red-400/60 hover:text-red-400 hover:bg-red-500/8 transition-all duration-200"
              >
                <Trash2 size={11} />
                Clear Dataset
              </button>
            </>
          ) : (
            <div className="text-center py-8">
              <FileSpreadsheet size={28} className="mx-auto text-[#3a3a5a] mb-3" />
              <p className="text-[10px] text-[#5a5a7a]">No dataset loaded</p>
              <p className="text-[9px] text-[#4a4a6a] mt-1">Upload a CSV to get started</p>
            </div>
          )}

          {/* Privacy Badge */}
          <div className="rounded-xl border border-[#10b981]/15 bg-[#10b981]/5 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Lock size={12} className="text-[#10b981]" />
              <span className="text-[10px] font-semibold text-[#10b981]">Privacy Secured</span>
            </div>
            <p className="text-[9px] text-[#6a8a7a] leading-relaxed">
              Your data never leaves this server. All processing is done locally.
            </p>
          </div>
        </div>

        {/* ── Bottom: Export PDF ── */}
        <div className="p-4 border-t border-[#2a2a4a]/40">
          <button
            onClick={onExportPDF}
            disabled={!fileData}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
              fileData
                ? 'btn-primary'
                : 'bg-[#2a2a4a]/30 text-[#4a4a6a] cursor-not-allowed'
            }`}
          >
            <Download size={14} />
            Export PDF Report
          </button>
        </div>
      </aside>

      {/* Semantic Layer Editor Modal */}
      <SemanticLayerEditor
        isOpen={showEditor}
        onClose={() => setShowEditor(false)}
        semanticLayer={semanticLayer || []}
        onSave={handleSaveSemanticLayer}
        sessionId={sessionId}
      />
    </>
  );
}
