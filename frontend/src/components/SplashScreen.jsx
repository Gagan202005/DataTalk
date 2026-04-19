import React, { useState } from 'react';
import { ArrowRight, Shield, FlaskConical, CheckCircle2, Brain, FileText } from 'lucide-react';

const PILLARS = [
  { icon: Shield,        label: 'Security',         color: '#00D4A1' },
  { icon: CheckCircle2,  label: 'Compliance',        color: '#7B3FE4' },
  { icon: FlaskConical,  label: 'Model Lab',         color: '#f59e0b' },
  { icon: Brain,         label: 'AI Queries',        color: '#3b82f6' },
  { icon: FileText,      label: 'Audit Reports',     color: '#ec4899' },
];

export default function SplashScreen({ onComplete }) {
  const [fadeOut, setFadeOut] = useState(false);

  const handleOpen = () => {
    setFadeOut(true);
    setTimeout(() => onComplete(), 500);
  };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

    .lp-root {
      position: fixed; inset: 0; z-index: 100;
      background: #000;
      font-family: 'Inter', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      transition: opacity 0.5s ease;
    }
    .lp-root.lp-fade-out { opacity: 0; pointer-events: none; }

    /* Blobs */
    .lp-blob {
      position: absolute;
      border-radius: 50%;
      filter: blur(140px);
      pointer-events: none;
      z-index: 0;
    }
    .lp-blob-1 {
      width: 700px; height: 700px;
      background: radial-gradient(circle, rgba(123,63,228,0.15) 0%, transparent 70%);
      top: -200px; left: -150px;
    }
    .lp-blob-2 {
      width: 500px; height: 500px;
      background: radial-gradient(circle, rgba(0,212,161,0.10) 0%, transparent 70%);
      bottom: -120px; right: -80px;
    }

    /* Center stage */
    .lp-stage {
      position: relative; z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 28px;
      max-width: 680px;
      padding: 0 24px;
    }

    /* Top metadata */
    .lp-meta {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .lp-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 5px 16px;
      border-radius: 99px;
      border: 1px solid rgba(123,63,228,0.4);
      background: rgba(123,63,228,0.1);
      font-size: 11.5px;
      font-weight: 600;
      color: #b48eff;
      letter-spacing: 0.04em;
    }
    .lp-badge-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #00D4A1;
      flex-shrink: 0;
      animation: lp-pulse 2s ease-in-out infinite;
    }
    @keyframes lp-pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
    .lp-team {
      font-size: 11px;
      font-weight: 500;
      color: rgba(255,255,255,0.25);
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    /* Headline */
    .lp-headline {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .lp-kicker {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.3);
    }
    .lp-h1 {
      font-size: clamp(52px, 7vw, 88px);
      font-weight: 900;
      color: #fff;
      line-height: 1.0;
      letter-spacing: -0.04em;
      margin: 0;
    }
    .lp-h1 .lp-grad {
      background: linear-gradient(135deg, #9b6dff 0%, #00D4A1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .lp-sub {
      font-size: 16px;
      font-weight: 400;
      color: rgba(255,255,255,0.45);
      line-height: 1.6;
      max-width: 460px;
      margin: 6px 0 0;
    }
    .lp-sub strong { color: rgba(255,255,255,0.75); font-weight: 600; }

    /* Pillars */
    .lp-pillars {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
    }
    .lp-pillar {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 8px 16px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.03);
      font-size: 13px;
      font-weight: 600;
      color: rgba(255,255,255,0.7);
      cursor: default;
      transition: background 0.2s, border-color 0.2s, color 0.2s;
    }
    .lp-pillar:hover {
      background: rgba(255,255,255,0.07);
      border-color: rgba(255,255,255,0.18);
      color: #fff;
    }
    .lp-pillar-dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    /* Divider */
    .lp-divider {
      width: 1px; height: 18px;
      background: rgba(255,255,255,0.12);
    }

    /* CTA */
    .lp-cta {
      position: relative;
      overflow: hidden;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 15px 40px;
      border-radius: 14px;
      background: #fff;
      color: #000;
      font-family: 'Inter', sans-serif;
      font-size: 15px;
      font-weight: 800;
      border: none;
      cursor: pointer;
      letter-spacing: -0.01em;
      transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.28s, background 0.2s;
      box-shadow: 0 0 0 1px rgba(255,255,255,0.15), 0 8px 32px rgba(255,255,255,0.08);
    }
    .lp-cta:hover {
      transform: translateY(-3px) scale(1.03);
      box-shadow: 0 0 0 1px rgba(255,255,255,0.3), 0 16px 48px rgba(255,255,255,0.14);
      background: #f0f0f0;
    }
    .lp-cta .lp-arrow { transition: transform 0.2s ease; }
    .lp-cta:hover .lp-arrow { transform: translateX(4px); }

    /* Footnote */
    .lp-footnote {
      font-size: 10.5px;
      color: rgba(255,255,255,0.2);
      letter-spacing: 0.03em;
    }

    /* Animations */
    .lp-a { animation: lp-fadeUp 0.6s ease-out both; }
    @keyframes lp-fadeUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;

  return (
    <>
      <style>{css}</style>
      <div className={`lp-root${fadeOut ? ' lp-fade-out' : ''}`}>
        <div className="lp-blob lp-blob-1" />
        <div className="lp-blob lp-blob-2" />

        <div className="lp-stage">

          {/* Badge + team */}
          <div className="lp-meta lp-a" style={{ animationDelay: '0s' }}>
            <div className="lp-badge">
              <span className="lp-badge-dot" />
              NatWest Code for Purpose · 2026
            </div>
            <span className="lp-team">team: swords of summer</span>
          </div>

          {/* Main headline */}
          <div className="lp-headline lp-a" style={{ animationDelay: '0.1s' }}>
            <span className="lp-kicker">Theme</span>
            <h1 className="lp-h1">
              Talk to <span className="lp-grad">Data.</span>
            </h1>
            <p className="lp-sub">
              Ask anything. Get instant answers.<br />
              <strong>Security and compliance built in from day one.</strong>
            </p>
          </div>

          {/* Core pillars */}
          <div className="lp-pillars lp-a" style={{ animationDelay: '0.2s' }}>
            {PILLARS.map((p, i) => {
              const Icon = p.icon;
              return (
                <React.Fragment key={p.label}>
                  <div className="lp-pillar">
                    <span className="lp-pillar-dot" style={{ background: p.color }} />
                    {p.label}
                  </div>
                  {i < PILLARS.length - 1 && <div className="lp-divider" />}
                </React.Fragment>
              );
            })}
          </div>

          {/* CTA */}
          <button className="lp-cta lp-a" style={{ animationDelay: '0.32s' }} onClick={handleOpen}>
            Open <ArrowRight size={16} className="lp-arrow" />
          </button>

          <span className="lp-footnote lp-a" style={{ animationDelay: '0.42s' }}>
            No setup required · Password protected
          </span>

        </div>
      </div>
    </>
  );
}
