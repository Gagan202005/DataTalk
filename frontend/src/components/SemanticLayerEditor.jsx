import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Layers, AlertCircle, Check, Info } from 'lucide-react';

const SUGGESTED = [
  { name: 'Total Revenue',       expression: 'SUM(revenue)',                           description: 'Sum of all revenue values' },
  { name: 'Average Order Value', expression: 'AVG(order_amount)',                       description: 'Mean order amount' },
  { name: 'Customer Count',      expression: 'COUNT(DISTINCT customer_id)',              description: 'Unique customer count' },
  { name: 'Conversion Rate',     expression: 'COUNT(purchases) / COUNT(visits) * 100',  description: 'Purchase to visit ratio' },
];

export default function SemanticLayerEditor({ isOpen, onClose, semanticLayer, onSave }) {
  const [metrics,     setMetrics]     = useState(semanticLayer || []);
  const [newMetric,   setNewMetric]   = useState({ name: '', expression: '', description: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState(null);
  const [showInfo,    setShowInfo]    = useState(false);

  useEffect(() => { if (isOpen) setMetrics(semanticLayer || []); }, [isOpen, semanticLayer]);

  if (!isOpen) return null;

  const handleQuickAdd = (sm) => {
    if (metrics.some(m => m.name === sm.name)) return;
    setMetrics(prev => [...prev, { ...sm, id: Date.now() }]);
  };

  const handleAddMetric = () => {
    if (!newMetric.name.trim() || !newMetric.expression.trim()) return;
    setMetrics(prev => [...prev, { ...newMetric, id: Date.now() }]);
    setNewMetric({ name: '', expression: '', description: '' });
    setShowAddForm(false);
  };

  const handleDelete = (key) => {
    setMetrics(prev => prev.filter(m => (m.id || m.name) !== key));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (onSave) await onSave(metrics);
      onClose();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      {/* Overlay — no blur */}
      <div className="modal-overlay" onClick={onClose} />

      {/* Modal — solid white, no glassmorphism */}
      <div style={{
        position: 'relative', width: '100%', maxWidth: 720, maxHeight: '88vh',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'fadeInUp 0.2s ease-out both',
      }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-light)', border: '1px solid rgba(79,70,229,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Layers size={18} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Semantic Layer</h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Define business metrics and expressions</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => setShowInfo(v => !v)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 7, border: 'none', background: showInfo ? 'var(--accent-light)' : 'transparent', color: showInfo ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer' }}
                title="What is the Semantic Layer?"
              >
                <Info size={15} />
              </button>
              <button
                onClick={onClose}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {showInfo && (
            <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 10, background: 'var(--accent-light)', border: '1px solid rgba(79,70,229,0.15)' }}>
              <p style={{ fontSize: 13, color: 'var(--accent)', lineHeight: 1.65 }}>
                <strong>What is the Semantic Layer?</strong><br />
                Define reusable business metrics using SQL expressions — e.g.{' '}
                <code style={{ background: 'rgba(79,70,229,0.1)', padding: '1px 5px', borderRadius: 4, fontSize: 12, fontFamily: 'monospace' }}>Total Revenue = SUM(amount)</code>.
                Once defined, DataTalk will use these named metrics when answering your questions,
                so you can ask <em>"What is our Total Revenue this month?"</em> and get accurate results
                using your own business terminology instead of raw column names.
              </p>
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid rgba(220,38,38,0.2)' }}>
              <AlertCircle size={14} style={{ color: 'var(--error)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--error)' }}>{error}</span>
            </div>
          )}

          {/* Quick add */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 10 }}>Quick add suggested metrics</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {SUGGESTED.map((sm, i) => {
                const added = metrics.some(m => m.name === sm.name);
                return (
                  <button
                    key={i}
                    onClick={() => handleQuickAdd(sm)}
                    disabled={added}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '7px 14px', borderRadius: 99, fontSize: 12.5, fontWeight: 500,
                      border: '1px solid', cursor: added ? 'default' : 'pointer', fontFamily: 'inherit',
                      background: added ? '#f0fdf4' : 'var(--bg-subtle)',
                      borderColor: added ? '#bbf7d0' : 'var(--border)',
                      color: added ? 'var(--success)' : 'var(--text-secondary)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {added ? <Check size={11} /> : <Plus size={11} />}
                    {sm.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Defined metrics */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 10 }}>
              Defined metrics ({metrics.length})
            </p>
            {metrics.length === 0 ? (
              <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--text-xmuted)', fontSize: 13 }}>
                No metrics yet. Quick-add above or create a custom one below.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {metrics.map((m) => {
                  const key = m.id || m.name;
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 16px', borderRadius: 10, background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</p>
                        <p style={{ fontSize: 12.5, fontFamily: 'monospace', color: 'var(--accent)', marginTop: 3 }}>{m.expression}</p>
                        {m.description && (
                          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{m.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(key)}
                        style={{ flexShrink: 0, padding: 6, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-xmuted)', cursor: 'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--error)'; e.currentTarget.style.background = '#fef2f2'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-xmuted)'; e.currentTarget.style.background = 'transparent'; }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add form / add button */}
          {showAddForm ? (
            <div style={{ padding: 16, borderRadius: 10, background: 'var(--bg-subtle)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>New metric</p>
              {[
                { key: 'name',        ph: 'Metric name  (e.g. Total Revenue)',  mono: false },
                { key: 'expression',  ph: 'SQL expression  (e.g. SUM(amount))', mono: true  },
                { key: 'description', ph: 'Description (optional)',              mono: false },
              ].map(({ key, ph, mono }) => (
                <input
                  key={key}
                  type="text"
                  placeholder={ph}
                  value={newMetric[key]}
                  onChange={e => setNewMetric(prev => ({ ...prev, [key]: e.target.value }))}
                  style={{
                    width: '100%', padding: '10px 13px', borderRadius: 8, background: 'var(--bg-card)',
                    border: '1px solid var(--border-strong)', fontSize: 13.5,
                    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                    fontFamily: mono ? '"JetBrains Mono", monospace' : 'inherit',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(79,70,229,0.5)'}
                  onBlur={e  => e.target.style.borderColor = 'var(--border-strong)'}
                />
              ))}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setShowAddForm(false); setNewMetric({ name: '', expression: '', description: '' }); }}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', fontSize: 12.5, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddMetric}
                  disabled={!newMetric.name.trim() || !newMetric.expression.trim()}
                  style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: (!newMetric.name.trim() || !newMetric.expression.trim()) ? 0.4 : 1 }}
                >
                  Add metric
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', borderRadius: 10, border: '1.5px dashed var(--border-strong)', background: 'transparent', fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(79,70,229,0.4)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-light)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <Plus size={15} /> Add custom metric
            </button>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'var(--text-xmuted)' }}>
            {metrics.length} metric{metrics.length !== 1 ? 's' : ''} defined
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', fontSize: 12.5, fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}
            >
              <Save size={13} />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
