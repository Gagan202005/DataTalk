import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';

const PASSWORD = 'xy223';

export default function AuthGate({ onAuth }) {
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (value === PASSWORD) {
      onAuth();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div className="auth-overlay">
      <div className={`auth-card${shake ? ' auth-shake' : ''}`}>
        <div className="auth-icon">
          <ShieldCheck size={28} />
        </div>
        <div className="auth-title">DataTalk</div>
        <div className="auth-subtitle">Enter access password to continue</div>

        <form onSubmit={submit} className="auth-form">
          <div className="auth-input-wrap">
            <Lock size={14} className="auth-input-icon" />
            <input
              type={show ? 'text' : 'password'}
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(false); }}
              placeholder="Password"
              className={`auth-input${error ? ' auth-input-error' : ''}`}
              autoFocus
            />
            <button type="button" className="auth-eye" onClick={() => setShow(v => !v)}>
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          {error && <div className="auth-error">Incorrect password</div>}
          <button type="submit" className="auth-submit">Unlock</button>
        </form>
      </div>
    </div>
  );
}
