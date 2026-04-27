import React, { useState, useEffect } from 'react';
import { BarChart2, Upload, Search, CreditCard, Users, Building2, Loader } from 'lucide-react';
import { api } from '../services/api';

const ICON_MAP = { 'building-2': Building2, 'credit-card': CreditCard, users: Users };

export default function WelcomeScreen({ onAction, onSampleLoad, hasDataset }) {
  const [datasets, setDatasets]     = useState([]);
  const [loadingId, setLoadingId]   = useState(null);

  useEffect(() => {
    api.getSampleDatasets().then(d => setDatasets(d.datasets || [])).catch(() => {});
  }, []);

  const handleSampleLoad = async (ds) => {
    if (!ds.available || loadingId) return;
    setLoadingId(ds.id);
    try {
      await onSampleLoad(ds.id);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="welcome-wrap">
      <div className="welcome-logo">
        <BarChart2 size={24} />
      </div>

      <h1 className="welcome-title">
        {hasDataset ? 'What would you like to know?' : 'Financial Analyst Copilot'}
      </h1>

      <p className="welcome-sub">
        {hasDataset
          ? 'Ask questions in plain English — SQL queries, charts, compliance checks, and ML predictions.'
          : 'Upload your own dataset or start instantly with a built-in sample. Ask questions in plain English.'}
      </p>

      {/* Primary actions */}
      <div className="welcome-actions">
        {!hasDataset && (
          <button className="welcome-action-btn welcome-action-primary" onClick={() => onAction('__upload__')}>
            <Upload size={15} />
            Upload dataset
          </button>
        )}
        {hasDataset && (
          <>
            <button className="welcome-action-btn welcome-action-secondary" onClick={() => onAction('Give me an overview of this dataset')}>
              <Search size={14} />
              Dataset overview
            </button>
            <button className="welcome-action-btn welcome-action-secondary" onClick={() => onAction('Show me the top trends in this data')}>
              <BarChart2 size={14} />
              Show trends
            </button>
          </>
        )}
        {!hasDataset && (
          <button className="welcome-action-btn welcome-action-secondary" onClick={() => onAction('What can you help me analyze?')}>
            <Search size={14} />
            What can you do?
          </button>
        )}
      </div>

      {/* Sample dataset cards — only when no dataset loaded */}
      {!hasDataset && datasets.length > 0 && (
        <div style={{ marginTop: 32, width: '100%', maxWidth: 680 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, textAlign: 'center', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Or try a sample dataset
          </p>
          <div className="sample-dataset-grid">
            {datasets.map(ds => {
              const Icon = ICON_MAP[ds.icon] || BarChart2;
              const isLoading = loadingId === ds.id;
              return (
                <button
                  key={ds.id}
                  className={`sample-dataset-card${!ds.available ? ' unavailable' : ''}`}
                  onClick={() => handleSampleLoad(ds)}
                  disabled={!ds.available || !!loadingId}
                  title={!ds.available ? 'Run the generator script first' : ds.description}
                >
                  <div className="sample-dataset-icon">
                    {isLoading ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Icon size={18} />}
                  </div>
                  <div className="sample-dataset-info">
                    <div className="sample-dataset-name">{ds.name}</div>
                    <div className="sample-dataset-desc">{ds.description}</div>
                    <div className="sample-dataset-tags">
                      {(ds.tags || []).map(t => <span key={t} className="sample-dataset-tag">{t}</span>)}
                    </div>
                  </div>
                  <div className="sample-dataset-rows">{(ds.rows || 0).toLocaleString()} rows</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
