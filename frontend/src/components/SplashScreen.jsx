import React, { useState } from 'react';
import { ArrowRight, Shield, FlaskConical, CheckCircle2, BarChart2, FileText, Globe, Lock } from 'lucide-react';

const HIGHLIGHT_CARDS = [
  {
    icon: Shield,
    accent: '#00D4A1',
    label: 'Security First',
    headline: 'Zero-trust by default',
    body: 'End-to-end data masking, sensitive column detection, audit trails, and real-time compliance guardrails on every query.',
    glow: true,
  },
  {
    icon: FlaskConical,
    accent: '#7B3FE4',
    label: 'Python ML Engine',
    headline: 'Full analytics power',
    body: 'Sandboxed Python environment with pandas, scikit-learn & matplotlib. Run regressions, clustering, forecasts — no code needed.',
  },
  {
    icon: CheckCircle2,
    accent: '#3b82f6',
    label: 'Compliance Ready',
    headline: 'Regulatory out of the box',
    body: 'PMLA / AML, KYC / CDD, DPDP Act 2023, IRAC Norms — every response is validated against live compliance rules.',
  },
];

const SECONDARY = ['Natural Language SQL', 'Interactive Charts', 'PDF Audit Reports', 'Web Search', 'Schema Explorer'];

export default function SplashScreen({ onComplete }) {
  const [fadeOut, setFadeOut] = useState(false);

  const handleOpen = () => {
    setFadeOut(true);
    setTimeout(() => onComplete(), 500);
  };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');

    .lp-root {
      position: fixed; inset: 0; z-index: 100;
      background: #000;
      font-family: 'Inter', sans-serif;
      overflow-y: auto;
      transition: opacity 0.5s ease;
    }
    .lp-root.lp-out { opacity: 0; pointer-events: none; }

    .lp-blob {
      position: fixed;
      border-radius: 50%;
      filter: blur(160px);
      pointer-events: none;
      z-index: 0;
    }
    .lp-blob-1 {
      width: 800px; height: 800px;
      background: radial-gradient(circle, rgba(123,63,228,0.13) 0%, transparent 65%);
      top: -300px; left: -200px;
    }
    .lp-blob-2 {
      width: 600px; height: 600px;
      background: radial-gradient(circle, rgba(0,212,161,0.09) 0%, transparent 65%);
      bottom: -200px; right: -100px;
    }

    /* ── Stage ── */
    .lp-stage {
      position: relative; z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 0;
      min-height: 100vh;
      max-width: 860px;
      width: 100%;
      margin: 0 auto;
      padding: 48px 24px 56px;
      box-sizing: border-box;
    }

    /* Badge row */
    .lp-top {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      margin-bottom: 36px;
    }
    .lp-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px;
      border-radius: 99px;
      border: 1px solid rgba(123,63,228,0.5);
      background: rgba(123,63,228,0.1);
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      font-weight: 600;
      color: #c4a8ff;
      letter-spacing: 0.03em;
    }
    .lp-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #00D4A1;
      animation: lp-blink 2s ease-in-out infinite;
    }
    @keyframes lp-blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
    .lp-team {
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.22);
    }

    /* Headline block */
    .lp-headline-block { margin-bottom: 14px; }
    .lp-kicker {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.28);
      margin-bottom: 10px;
    }
    .lp-h1 {
      font-family: 'Space Grotesk', sans-serif;
      font-size: clamp(56px, 8vw, 96px);
      font-weight: 700;
      color: #fff;
      line-height: 1.0;
      letter-spacing: -0.04em;
      margin: 0;
    }
    .lp-h1 .g {
      background: linear-gradient(135deg, #a78bfa 0%, #00D4A1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    /* Tagline */
    .lp-tagline {
      font-family: 'Inter', sans-serif;
      font-size: clamp(15px, 1.8vw, 18px);
      font-weight: 400;
      color: rgba(255,255,255,0.42);
      line-height: 1.65;
      max-width: 560px;
      margin: 0 auto 40px;
    }
    .lp-tagline strong {
      color: rgba(255,255,255,0.78);
      font-weight: 600;
    }

    /* Highlight cards */
    .lp-cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      width: 100%;
      margin-bottom: 28px;
    }
    .lp-card {
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.07);
      background: rgba(255,255,255,0.03);
      padding: 20px 20px 22px;
      text-align: left;
      transition: border-color 0.25s, background 0.25s, box-shadow 0.25s;
      cursor: default;
    }
    .lp-card:hover {
      background: rgba(255,255,255,0.055);
      border-color: rgba(255,255,255,0.14);
    }
    .lp-card.glow {
      border-color: rgba(0,212,161,0.3);
      background: rgba(0,212,161,0.04);
      box-shadow: 0 0 40px rgba(0,212,161,0.08);
    }
    .lp-card.glow:hover {
      border-color: rgba(0,212,161,0.5);
      box-shadow: 0 0 60px rgba(0,212,161,0.13);
    }
    .lp-card-top {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }
    .lp-card-icon {
      width: 32px; height: 32px;
      border-radius: 9px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .lp-card-chip {
      font-family: 'Inter', sans-serif;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      padding: 3px 9px;
      border-radius: 99px;
      border: 1px solid;
    }
    .lp-card-headline {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 17px;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.02em;
      margin-bottom: 7px;
    }
    .lp-card-body {
      font-size: 12.5px;
      color: rgba(255,255,255,0.45);
      line-height: 1.6;
    }

    /* Secondary pills */
    .lp-secondary {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
      margin-bottom: 36px;
    }
    .lp-pill {
      font-size: 12px;
      font-weight: 500;
      color: rgba(255,255,255,0.4);
      padding: 5px 14px;
      border-radius: 99px;
      border: 1px solid rgba(255,255,255,0.09);
      background: transparent;
      cursor: default;
      transition: color 0.2s, border-color 0.2s;
    }
    .lp-pill:hover { color: rgba(255,255,255,0.75); border-color: rgba(255,255,255,0.22); }

    /* CTA */
    .lp-cta-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .lp-cta {
      position: relative; overflow: hidden;
      display: inline-flex; align-items: center; gap: 10px;
      padding: 15px 44px;
      border-radius: 14px;
      background: #fff;
      color: #000;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 16px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      letter-spacing: -0.01em;
      transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.28s;
      box-shadow: 0 0 0 1px rgba(255,255,255,0.2), 0 8px 32px rgba(255,255,255,0.07);
    }
    .lp-cta:hover {
      transform: translateY(-3px) scale(1.03);
      box-shadow: 0 0 0 1px rgba(255,255,255,0.35), 0 16px 48px rgba(255,255,255,0.13);
    }
    .lp-cta .arr { transition: transform 0.2s; }
    .lp-cta:hover .arr { transform: translateX(4px); }
    .lp-cta::after {
      content: '';
      position: absolute; inset: 0;
      background: linear-gradient(90deg, transparent, rgba(0,0,0,0.04), transparent);
      transform: translateX(-100%);
      animation: lp-sh 3s infinite;
    }
    @keyframes lp-sh { 60%,100%{ transform: translateX(200%); } }
    .lp-footnote {
      font-size: 11px;
      color: rgba(255,255,255,0.18);
      letter-spacing: 0.03em;
    }

    /* Animations */
    .a { animation: lp-up 0.6s ease-out both; }
    @keyframes lp-up {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 680px) {
      .lp-cards { grid-template-columns: 1fr; }
      .lp-h1 { font-size: 52px; }
    }
  `;

  return (
    <>
      <style>{css}</style>
      <div className={`lp-root${fadeOut ? ' lp-out' : ''}`}>
        <div className="lp-blob lp-blob-1" />
        <div className="lp-blob lp-blob-2" />

        <div className="lp-stage">

          {/* Badge + team */}
          <div className="lp-top a" style={{ animationDelay: '0s' }}>
            <div className="lp-badge">
              <span className="lp-dot" />
              NatWest Code for Purpose · 2026
            </div>
            <span className="lp-team">Team: Swords of Summer</span>
          </div>

          {/* Headline */}
          <div className="lp-headline-block a" style={{ animationDelay: '0.08s' }}>
            <p className="lp-kicker">Theme</p>
            <h1 className="lp-h1">Talk to <span className="g">Data.</span></h1>
          </div>

          {/* Tagline */}
          <p className="lp-tagline a" style={{ animationDelay: '0.16s' }}>
            Run complex analytics, ML models &amp; compliance checks —{' '}
            <strong>without writing a single line of code.</strong><br />
            Powered by a full Python environment, live web search, and AI.
          </p>

          {/* 3 highlight cards */}
          <div className="lp-cards a" style={{ animationDelay: '0.24s' }}>
            {HIGHLIGHT_CARDS.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.label} className={`lp-card${c.glow ? ' glow' : ''}`}>
                  <div className="lp-card-top">
                    <div
                      className="lp-card-icon"
                      style={{ background: `${c.accent}18`, border: `1px solid ${c.accent}35` }}
                    >
                      <Icon size={15} style={{ color: c.accent }} />
                    </div>
                    <span
                      className="lp-card-chip"
                      style={{ color: c.accent, borderColor: `${c.accent}40`, background: `${c.accent}10` }}
                    >
                      {c.label}
                    </span>
                  </div>
                  <div className="lp-card-headline">{c.headline}</div>
                  <div className="lp-card-body">{c.body}</div>
                </div>
              );
            })}
          </div>

          {/* Secondary pills */}
          <div className="lp-secondary a" style={{ animationDelay: '0.32s' }}>
            {SECONDARY.map((s) => (
              <span key={s} className="lp-pill">{s}</span>
            ))}
          </div>

          {/* CTA */}
          <div className="lp-cta-wrap a" style={{ animationDelay: '0.4s' }}>
            <button className="lp-cta" onClick={handleOpen}>
              Open <ArrowRight size={16} className="arr" />
            </button>
            <span className="lp-footnote">No setup required · No account needed</span>
          </div>

        </div>
      </div>
    </>
  );
}
