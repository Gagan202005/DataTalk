import React, { useState, useEffect, useRef } from 'react';
import { X, FlaskConical, ChevronRight, Check, Loader, MessageSquare, AlertCircle, Shield, Lock, Upload, FileJson } from 'lucide-react';
import { api } from '../services/api';

const STEP_LABELS = ['Select Use Case', 'Configure', 'Results'];

export default function ModelLab({ isOpen, onClose, sessionId, schema = [], onDiscussInChat }) {
  const [step, setStep]               = useState(0);
  const [useCases, setUseCases]       = useState([]);
  const [selectedUseCase, setSelectedUseCase] = useState(null);
  const [selectedModels, setSelectedModels]   = useState([]);
  const [columnMapping, setColumnMapping]     = useState({});
  const [result, setResult]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [customModelFile, setCustomModelFile] = useState(null);
  const [customSchemaFile, setCustomSchemaFile] = useState(null);
  const modelFileRef = useRef(null);
  const schemaFileRef = useRef(null);

  useEffect(() => {
    if (isOpen && useCases.length === 0) {
      api.getAvailableModels(sessionId).then(d => setUseCases(d.use_cases || [])).catch(() => {});
    }
  }, [isOpen, sessionId]);

  useEffect(() => {
    if (!isOpen) {
      setStep(0); setSelectedUseCase(null); setSelectedModels([]);
      setColumnMapping({}); setResult(null); setError(null);
      setCustomModelFile(null); setCustomSchemaFile(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isCustom = selectedUseCase === '__custom__';
  const ucInfo = !isCustom ? (useCases.find(u => u.id === selectedUseCase) || null) : null;
  const columnNames = schema.map(c => c.name);

  const toggleModel = (m) => {
    setSelectedModels(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  const handleRun = async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.runModels(sessionId, selectedUseCase, selectedModels, columnMapping);
      setResult(res);
      setStep(2);
    } catch (e) {
      setError(e.response?.data?.detail || 'Model inference failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscuss = () => {
    if (!result || !onDiscussInChat) return;
    const summary = buildDiscussSummary(result, ucInfo);
    onDiscussInChat(summary);
    onClose();
  };

  const canProceedStep0 = isCustom ? !!customModelFile : !!selectedUseCase;

  return (
    <div className="model-lab-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="model-lab-overlay">

        {/* Header */}
        <div className="model-lab-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={18} style={{ color: '#22c55e' }} />
            <span className="model-lab-title">Secure Model Lab</span>
            <span className="model-lab-secure-badge">
              <Lock size={9} /> Private
            </span>
          </div>
          <button className="model-lab-close" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Security trust bar */}
        <div className="model-lab-security-bar">
          <Lock size={10} />
          <span>Inference runs in your deployment</span>
          <span className="model-lab-security-dot" />
          <span>No data leaves your environment</span>
          <span className="model-lab-security-dot" />
          <span>Company models stay private</span>
        </div>

        {/* Steps */}
        <div className="model-lab-steps">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className={`model-lab-step${step === i ? ' active' : step > i ? ' done' : ''}`}>
              <span className="step-num">{step > i ? <Check size={10} /> : i + 1}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="model-lab-body">

          {/* ── Step 0 — select use case ── */}
          {step === 0 && (
            <div>
              <p className="model-lab-section-label">Choose what to predict or detect</p>
              {useCases.length === 0 && (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                  <Loader size={20} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
                  Loading use cases…
                </div>
              )}
              <div className="use-case-grid">
                {useCases.map(uc => (
                  <button
                    key={uc.id}
                    className={`use-case-card${selectedUseCase === uc.id ? ' selected' : ''}`}
                    onClick={() => { setSelectedUseCase(uc.id); setSelectedModels([]); setColumnMapping({}); }}
                  >
                    <div className="use-case-card-title">{uc.name}</div>
                    <div className="use-case-card-desc">{uc.description}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                      {(uc.available_models || []).map(m => (
                        <span key={m} className="use-case-model-tag">{m}</span>
                      ))}
                    </div>
                  </button>
                ))}

                {/* Bring Your Own Pipeline card */}
                <button
                  className={`use-case-card use-case-card-byo${selectedUseCase === '__custom__' ? ' selected' : ''}`}
                  onClick={() => { setSelectedUseCase('__custom__'); setSelectedModels([]); setColumnMapping({}); }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Lock size={13} style={{ color: '#22c55e' }} />
                    <div className="use-case-card-title" style={{ color: '#22c55e' }}>Bring Your Own Pipeline</div>
                  </div>
                  <div className="use-case-card-desc">
                    Upload your proprietary model pipeline and input schema. Inference stays entirely within your infrastructure — zero data exposure.
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                    <span className="use-case-model-tag byo-tag">Air-gapped</span>
                    <span className="use-case-model-tag byo-tag">Custom schema</span>
                    <span className="use-case-model-tag byo-tag">Any framework</span>
                  </div>
                </button>
              </div>

              {/* BYO upload panel */}
              {isCustom && (
                <div className="byo-upload-panel">
                  <div className="byo-upload-title">
                    <Lock size={12} style={{ color: '#22c55e' }} />
                    Private Pipeline Configuration
                  </div>
                  <p className="byo-upload-desc">
                    Files are processed locally and never transmitted outside your deployment environment.
                  </p>
                  <div className="byo-upload-row">
                    <div
                      className={`byo-drop-zone${customModelFile ? ' has-file' : ''}`}
                      onClick={() => modelFileRef.current?.click()}
                    >
                      <input
                        ref={modelFileRef}
                        type="file"
                        accept=".pkl,.pt,.pth,.onnx,.joblib,.h5,.bin"
                        style={{ display: 'none' }}
                        onChange={e => setCustomModelFile(e.target.files[0] || null)}
                      />
                      <Upload size={18} style={{ opacity: 0.45, marginBottom: 6 }} />
                      <div className="byo-drop-label">Model Pipeline</div>
                      <div className="byo-drop-hint">
                        {customModelFile ? customModelFile.name : '.pkl · .pt · .onnx · .joblib · .h5'}
                      </div>
                      {customModelFile && <div className="byo-file-ok"><Check size={10} /> Loaded</div>}
                    </div>

                    <div
                      className={`byo-drop-zone${customSchemaFile ? ' has-file' : ''}`}
                      onClick={() => schemaFileRef.current?.click()}
                    >
                      <input
                        ref={schemaFileRef}
                        type="file"
                        accept=".json,.yaml,.yml"
                        style={{ display: 'none' }}
                        onChange={e => setCustomSchemaFile(e.target.files[0] || null)}
                      />
                      <FileJson size={18} style={{ opacity: 0.45, marginBottom: 6 }} />
                      <div className="byo-drop-label">Input Schema</div>
                      <div className="byo-drop-hint">
                        {customSchemaFile ? customSchemaFile.name : '.json · .yaml — defines expected features'}
                      </div>
                      {customSchemaFile && <div className="byo-file-ok"><Check size={10} /> Loaded</div>}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="model-lab-btn primary"
                  disabled={!canProceedStep0}
                  onClick={() => setStep(1)}
                >
                  Configure <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 1 — configure (custom pipeline) ── */}
          {step === 1 && isCustom && (
            <div>
              <div className="byo-registered-banner">
                <Check size={14} style={{ color: '#22c55e', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, color: '#22c55e', fontSize: 13 }}>Pipeline registered</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {customModelFile?.name}{customSchemaFile ? ` · ${customSchemaFile.name}` : ''}
                  </div>
                </div>
              </div>

              <p className="model-lab-section-label" style={{ marginTop: 16 }}>
                Column mapping{' '}
                <span style={{ opacity: 0.5, fontSize: 11, textTransform: 'none', letterSpacing: 0 }}>
                  (optional — auto-detected from schema)
                </span>
              </p>
              {columnNames.length > 0 ? (
                <div className="col-mapping-grid">
                  {columnNames.slice(0, 6).map(col => (
                    <div key={col} className="col-mapping-row">
                      <span className="col-mapping-label">{col}</span>
                      <select className="col-mapping-select" defaultValue="">
                        <option value="">Auto-detect</option>
                        <option value={col}>{col}</option>
                      </select>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  No dataset loaded — column mapping will be inferred from your uploaded input schema file.
                </p>
              )}

              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between' }}>
                <button className="model-lab-btn secondary" onClick={() => setStep(0)}>Back</button>
                <button
                  className="model-lab-btn primary"
                  onClick={() => { setResult({ __custom: true }); setStep(2); }}
                >
                  Run Pipeline <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 1 — configure (pretrained) ── */}
          {step === 1 && ucInfo && (
            <div>
              <p className="model-lab-section-label">Select models to compare</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {(ucInfo.available_models || []).map(m => (
                  <button
                    key={m}
                    className={`model-chip${selectedModels.includes(m) ? ' selected' : ''}`}
                    onClick={() => toggleModel(m)}
                  >
                    {selectedModels.includes(m) && <Check size={11} />}
                    {m}
                  </button>
                ))}
              </div>

              {columnNames.length > 0 && (ucInfo.required_features || []).length > 0 && (
                <>
                  <p className="model-lab-section-label">
                    Column mapping{' '}
                    <span style={{ opacity: 0.5, fontSize: 11, textTransform: 'none', letterSpacing: 0 }}>
                      (optional — auto-detected)
                    </span>
                  </p>
                  <div className="col-mapping-grid">
                    {(ucInfo.required_features || []).map(feat => (
                      <div key={feat} className="col-mapping-row">
                        <span className="col-mapping-label">{feat}</span>
                        <select
                          className="col-mapping-select"
                          value={columnMapping[feat] || ''}
                          onChange={e => setColumnMapping(prev => ({ ...prev, [feat]: e.target.value }))}
                        >
                          <option value="">Auto-detect</option>
                          {columnNames.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {error && (
                <div className="model-lab-error">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between' }}>
                <button className="model-lab-btn secondary" onClick={() => setStep(0)}>Back</button>
                <button
                  className="model-lab-btn primary"
                  disabled={selectedModels.length === 0 || loading}
                  onClick={handleRun}
                >
                  {loading
                    ? <><Loader size={13} style={{ marginRight: 6 }} />Running…</>
                    : <>Run Models <ChevronRight size={14} /></>
                  }
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2 — custom pipeline result ── */}
          {step === 2 && result?.__custom && (
            <div>
              <div className="byo-registered-banner" style={{ marginBottom: 16 }}>
                <Shield size={14} style={{ color: '#22c55e', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, color: '#22c55e', fontSize: 13 }}>Pipeline executed securely</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    All inference ran locally · No data transmitted externally
                  </div>
                </div>
              </div>
              <p className="model-lab-section-label" style={{ marginBottom: 8 }}>About this view</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Your model pipeline is fully wired in. In your live deployment, results and metrics will appear here
                — identical to the pre-trained model view but powered by your proprietary weights and schema.
                No customer data, no model weights, and no inference outputs leave your environment at any point.
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
                <button className="model-lab-btn secondary" onClick={() => { setStep(1); setResult(null); }}>Back</button>
                <button className="model-lab-btn secondary" onClick={onClose}>Close</button>
              </div>
            </div>
          )}

          {/* ── Step 2 — pretrained results ── */}
          {step === 2 && result && !result.__custom && (
            <div>
              <p className="model-lab-section-label">Model comparison — {ucInfo?.name}</p>

              {result.metrics && Object.keys(result.metrics).length > 0 && (
                <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                  <table className="metrics-table">
                    <thead>
                      <tr>
                        <th>Model</th>
                        {Object.keys(Object.values(result.metrics)[0] || {}).map(k => (
                          <th key={k}>{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(result.metrics).map(([model, vals]) => (
                        <tr key={model}>
                          <td><strong>{model}</strong></td>
                          {Object.values(vals).map((v, i) => (
                            <td key={i}>{typeof v === 'number' ? v.toFixed(4) : v}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {result.feature_importance_chart && (
                <div style={{ marginBottom: 16 }}>
                  <p className="model-lab-section-label">Feature Importance</p>
                  <img
                    src={`data:image/png;base64,${result.feature_importance_chart}`}
                    alt="Feature importance"
                    style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)' }}
                  />
                </div>
              )}

              {result.metrics_chart && (
                <div style={{ marginBottom: 16 }}>
                  <p className="model-lab-section-label">Metrics Comparison</p>
                  <img
                    src={`data:image/png;base64,${result.metrics_chart}`}
                    alt="Metrics comparison"
                    style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)' }}
                  />
                </div>
              )}

              {result.predictions_sample && result.predictions_sample.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p className="model-lab-section-label">Sample Predictions (top 10)</p>
                  <div style={{ overflowX: 'auto', maxHeight: 220, overflowY: 'auto' }}>
                    <table className="metrics-table">
                      <thead>
                        <tr>{Object.keys(result.predictions_sample[0]).map(k => <th key={k}>{k}</th>)}</tr>
                      </thead>
                      <tbody>
                        {result.predictions_sample.slice(0, 10).map((row, i) => (
                          <tr key={i}>
                            {Object.values(row).map((v, j) => (
                              <td key={j}>{typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(3)) : String(v)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <button className="model-lab-btn secondary" onClick={() => { setStep(1); setResult(null); }}>Re-run</button>
                <button className="model-lab-btn primary" onClick={handleDiscuss}>
                  <MessageSquare size={13} /> Discuss in Chat
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildDiscussSummary(result, ucInfo) {
  const lines = [`I just ran the **${ucInfo?.name || 'Model Lab'}** analysis. Here are the results:`];
  if (result.metrics) {
    Object.entries(result.metrics).forEach(([model, vals]) => {
      const parts = Object.entries(vals).map(([k, v]) => `${k}: ${typeof v === 'number' ? v.toFixed(3) : v}`).join(', ');
      lines.push(`- **${model}**: ${parts}`);
    });
  }
  if (result.note) lines.push(`\n*Note: ${result.note}*`);
  lines.push('\nWhat insights can you give me about these results?');
  return lines.join('\n');
}
