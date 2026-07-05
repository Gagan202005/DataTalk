import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { formatFileSize } from '../utils/csvParser';

export default function FileUpload({ onFileLoaded, disabled }) {
  const [parsing,    setParsing]   = useState(false);
  const [error,      setError]     = useState(null);
  const [loadedFile, setLoadedFile] = useState(null);

  const onDrop = useCallback(async (accepted, rejected) => {
    setError(null);
    if (rejected.length > 0) { setError('Invalid file type. Please upload a CSV, TSV, or JSON file.'); return; }
    if (accepted.length === 0) return;
    onFileLoaded(accepted[0]);
  }, [onFileLoaded]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'text/csv':                   ['.csv'],
      'text/tab-separated-values':  ['.tsv'],
      'application/json':           ['.json'],
      'text/plain':                 ['.txt'],
    },
    multiple: false,
    disabled: disabled || parsing,
  });

  if (loadedFile) {
    return (
      <div className="dropzone has-file" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', cursor: 'default' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <CheckCircle size={20} style={{ color: 'var(--success)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <FileSpreadsheet size={13} style={{ color: 'var(--success)', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loadedFile.name}</span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {formatFileSize(loadedFile.size)} · {loadedFile.rowCount?.toLocaleString()} rows · {loadedFile.colCount} columns
          </p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setLoadedFile(null); setError(null); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6 }}
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className={`dropzone${isDragActive ? ' active' : ''}${isDragReject ? ' rejected' : ''}`}
      >
        <input {...getInputProps()} />

        <div className="dropzone-icon">
          {parsing
            ? <Loader2 size={22} style={{ animation: 'spinSlow 1s linear infinite' }} />
            : isDragActive
              ? <FileSpreadsheet size={22} style={{ color: 'var(--accent)' }} />
              : <Upload size={20} />
          }
        </div>

        {parsing ? (
          <>
            <div className="dropzone-title">Parsing your data...</div>
            <div className="dropzone-sub">Analyzing schema and generating insights</div>
          </>
        ) : isDragActive ? (
          <>
            <div className="dropzone-title" style={{ color: 'var(--accent)' }}>Drop to upload</div>
            <div className="dropzone-sub">We'll analyze it instantly</div>
          </>
        ) : (
          <>
            <div className="dropzone-title">Drag and drop your dataset</div>
            <div className="dropzone-sub">
              or <span style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 500 }}>browse files</span>
            </div>
            <div className="dropzone-formats">
              {['.CSV', '.TSV', '.JSON'].map(ext => (
                <span key={ext} className="dropzone-format-tag">{ext}</span>
              ))}
            </div>
          </>
        )}
      </div>

      {error && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 7, padding: '9px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid rgba(220,38,38,0.2)' }}>
          <AlertCircle size={14} style={{ color: 'var(--error)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--error)' }}>{error}</span>
        </div>
      )}
    </div>
  );
}
