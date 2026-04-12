import React, { useState } from 'react';

export default function SplashScreen({ onComplete }) {
  const [fadeOut, setFadeOut] = useState(false);

  const handleSkip = () => {
    setFadeOut(true);
    setTimeout(() => onComplete(), 500);
  };

  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

    .hero-bg {
      background: #F5F6FA;
      background-image:
        radial-gradient(ellipse at 15% 50%, rgba(108,99,255,0.08) 0%, transparent 55%),
        radial-gradient(ellipse at 85% 20%, rgba(0,212,161,0.06) 0%, transparent 50%),
        linear-gradient(rgba(108,99,255,0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(108,99,255,0.04) 1px, transparent 1px);
      background-size: 100% 100%, 100% 100%, 44px 44px, 44px 44px;
      background-position: 0 0, 0 0, -1px -1px, -1px -1px;
      font-family: 'Inter', sans-serif;
    }

    .splash-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      align-items: center;
      width: 100%;
      height: 100%;
      min-height: 100vh;
    }

    .splash-left {
      padding: 60px 48px 60px 64px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .splash-right {
      position: relative;
      height: 100vh;
      min-height: 560px;
    }

    .badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 5px 14px;
      border-radius: 99px;
      background: rgba(108,99,255,0.12);
      border: 1px solid rgba(108,99,255,0.3);
      font-size: 12px;
      font-weight: 600;
      color: #a89fff;
      width: fit-content;
    }
    .live-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #00D4A1;
      flex-shrink: 0;
      animation: liveblink 2s ease-in-out infinite;
    }
    @keyframes liveblink { 0%,100%{opacity:1} 50%{opacity:0.3} }

    .splash-headline {
      font-size: clamp(32px, 3.8vw, 54px);
      font-weight: 300;
      color: #111827;
      line-height: 1.18;
      letter-spacing: -0.025em;
      margin: 0;
    }
    .splash-headline .grad {
      background: linear-gradient(135deg, #6C63FF 0%, #00D4A1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .splash-sub {
      font-size: 15px;
      font-weight: 400;
      color: #6B7280;
      line-height: 1.7;
      max-width: 100%;
      margin: 0;
    }

    .includes-label {
      font-size: 11px;
      font-weight: 600;
      color: #9CA3AF;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .tags-wrap { display: flex; flex-wrap: wrap; gap: 8px; }
    .feature-tag {
      display: inline-flex;
      align-items: center;
      padding: 5px 14px;
      border-radius: 8px;
      border: 1px solid rgba(0,0,0,0.1);
      background: rgba(255,255,255,0.8);
      font-size: 12.5px;
      font-weight: 500;
      color: #374151;
      transition: border-color 0.2s, background 0.2s, color 0.2s;
      cursor: default;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .feature-tag:hover {
      border-color: rgba(108,99,255,0.4);
      background: rgba(108,99,255,0.06);
      color: #6C63FF;
    }
    .feature-tag-more {
      background: rgba(108,99,255,0.1);
      border-color: rgba(108,99,255,0.3);
      color: #6C63FF;
    }

    .cta-primary {
      position: relative;
      overflow: hidden;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 28px;
      border-radius: 10px;
      background: #6C63FF;
      color: #ffffff;
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      width: fit-content;
      transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.28s;
      box-shadow: 0 4px 20px rgba(108,99,255,0.35);
    }
    .cta-primary:hover {
      transform: translateY(-2px) scale(1.02);
      box-shadow: 0 10px 30px rgba(108,99,255,0.45);
    }
    .cta-primary .arrow { transition: transform 0.2s ease; }
    .cta-primary:hover .arrow { transform: translateX(3px); }
    .cta-primary::after {
      content: '';
      position: absolute; inset: 0;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
      transform: translateX(-100%);
      animation: cta-shimmer 3s infinite;
    }
    @keyframes cta-shimmer { 60%,100%{ transform: translateX(200%); } }

    .dash-card {
      background: rgba(255,255,255,0.85);
      border: 1px solid rgba(0,0,0,0.07);
      backdrop-filter: blur(16px);
      border-radius: 16px;
      padding: 14px 16px;
      position: absolute;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      transition:
        transform 0.35s cubic-bezier(0.34,1.56,0.64,1),
        box-shadow 0.3s ease,
        border-color 0.3s ease;
      cursor: default;
    }
    .dash-card:hover {
      transform: scale(1.09) translateY(-8px) rotate(0deg) !important;
      box-shadow: 0 24px 64px rgba(108,99,255,0.18), 0 0 0 1px rgba(108,99,255,0.3);
      border-color: rgba(108,99,255,0.35);
      z-index: 20 !important;
    }
    .card-label {
      font-size: 9px; font-weight: 700;
      color: #9CA3AF;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      display: flex; align-items: center; gap: 5px;
      margin-bottom: 5px;
    }
    .card-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
    .card-val { font-size: 20px; font-weight: 700; color: #111827; letter-spacing: -0.02em; }
    .card-pos { font-size: 10px; color: #00A37A; margin-top: 2px; }
    .card-muted { font-size: 9px; color: #9CA3AF; }

    @keyframes gf1 { 0%,100%{ transform: rotate(-4deg) translateY(0); }   50%{ transform: rotate(-4deg) translateY(-7px); } }
    @keyframes gf2 { 0%,100%{ transform: rotate(3deg) translateY(0); }    50%{ transform: rotate(3deg) translateY(-6px); } }
    @keyframes gf3 { 0%,100%{ transform: rotate(-2.5deg) translateY(0); } 50%{ transform: rotate(-2.5deg) translateY(-9px); } }
    @keyframes gf4 { 0%,100%{ transform: rotate(3.5deg) translateY(0); }  50%{ transform: rotate(3.5deg) translateY(-6px); } }
    @keyframes gf5 {
      0%,100%{ transform: translateX(-50%) rotate(-1.5deg) translateY(0); }
      50%{     transform: translateX(-50%) rotate(-1.5deg) translateY(-8px); }
    }
    @keyframes dblink { 0%,100%{opacity:1} 50%{opacity:0.3} }

    .fade-up { animation: fadeUp 0.55s ease-out both; }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(22px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 768px) {
      .splash-grid { grid-template-columns: 1fr; }
      .splash-left { padding: 48px 28px; }
      .splash-right { display: none; }
    }
  `;

  return (
    <>
      <style>{styles}</style>
      <div
        className={`fixed inset-0 z-[100] hero-bg overflow-hidden transition-opacity duration-500 ease-in-out ${fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
      >
        <div className="splash-grid">

          {/* ── LEFT ── */}
          <div className="splash-left">

            <div className="badge-pill fade-up" style={{ animationDelay: '0s' }}>
              <span className="live-dot"></span>
              AI-powered data analysis
            </div>

            <h1 className="splash-headline fade-up" style={{ animationDelay: '0.1s' }}>
              Your AI-powered analyst for<br />
              <span className="grad">instant data insights.</span>
            </h1>

            <p className="splash-sub fade-up" style={{ animationDelay: '0.2s' }}>
              Upload datasets, explore schemas, generate PDF reports, and chat with
              your data to uncover actionable intelligence in seconds.
            </p>

            <div className="fade-up" style={{ animationDelay: '0.3s' }}>
              <p className="includes-label">Includes:</p>
              <div className="tags-wrap">
                {['SQL Queries', 'Chart Export', 'PDF Reports', 'Schema Explorer', 'AI Chat'].map(tag => (
                  <span key={tag} className="feature-tag">{tag}</span>
                ))}
                <span className="feature-tag feature-tag-more">+more</span>
              </div>
            </div>

            <div className="fade-up" style={{ animationDelay: '0.4s' }}>
              <button onClick={handleSkip} className="cta-primary">
                Go to Chatbot <span className="arrow">→</span>
              </button>
            </div>

          </div>

          {/* ── RIGHT: Tightly clustered cards ── */}
          <div className="splash-right">

            {/* Card 1 — Investment Analysis */}
            <div className="dash-card" style={{
              width: 195,
              top: '14%', left: '5%',
              transform: 'rotate(-4deg)',
              zIndex: 1,
              animation: 'gf1 4.5s 0s ease-in-out infinite',
            }}>
              <div className="card-label">
                <span className="card-dot" style={{ background: '#f59e0b', animation: 'dblink 2s 0s ease-in-out infinite' }}></span>
                Investment Analysis
              </div>
              <div className="card-val">$62,245</div>
              <div className="card-pos">↑ 12% vs last year</div>
              <svg viewBox="0 0 100 30" style={{ width: '100%', height: 28, marginTop: 8 }}>
                <path d="M0,25 L15,18 L25,22 L40,12 L55,15 L75,5 L100,2"
                  fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M0,25 L15,18 L25,22 L40,12 L55,15 L75,5 L100,2 L100,30 L0,30Z"
                  fill="rgba(245,158,11,0.1)" />
                <circle cx="100" cy="2" r="2.5" fill="#f59e0b" />
              </svg>
            </div>

            {/* Card 2 — Segment Summary */}
            <div className="dash-card" style={{
              width: 198,
              top: '11%', right: '5%',
              transform: 'rotate(3deg)',
              zIndex: 2,
              animation: 'gf2 4.5s 0.8s ease-in-out infinite',
            }}>
              <div className="card-label">
                <span className="card-dot" style={{ background: '#6C63FF', animation: 'dblink 2s 0.7s ease-in-out infinite' }}></span>
                Segment Summary
              </div>
              <div style={{ display: 'flex', gap: 14, marginBottom: 8 }}>
                <div>
                  <div className="card-val" style={{ fontSize: 18 }}>94k <span className="card-muted">Users</span></div>
                  <div className="card-muted">In segment</div>
                </div>
                <div>
                  <div className="card-val" style={{ fontSize: 18, color: '#00D4A1' }}>12k <span className="card-muted">Users</span></div>
                  <div className="card-muted">New</div>
                </div>
              </div>
              <svg viewBox="0 0 100 28" style={{ width: '100%', height: 24 }}>
                <path d="M0,20 L25,20 L40,8 L55,16 L70,12 L100,20"
                  fill="none" stroke="#f43f5e" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>

            {/* Card 3 — Financial Overview */}
            <div className="dash-card" style={{
              width: 188,
              top: '44%', left: '3%',
              transform: 'rotate(-2.5deg)',
              zIndex: 3,
              animation: 'gf3 4.5s 1.6s ease-in-out infinite',
            }}>
              <div className="card-label">
                <span className="card-dot" style={{ background: '#00D4A1', animation: 'dblink 2s 1.4s ease-in-out infinite' }}></span>
                Financial Overview
              </div>
              <div className="card-val">$4,910.90</div>
              <div style={{ display: 'flex', gap: 8, margin: '5px 0', fontSize: 9, color: '#6a6a8a' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#00D4A1', display: 'inline-block' }}></span>Revenue
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4a4a6a', display: 'inline-block' }}></span>Spend
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 32 }}>
                {[100, 55, 80, 35, 70, 45].map((h, i) => (
                  <div key={i} style={{
                    flex: 1, height: `${h}%`,
                    background: i % 2 === 0 ? '#00D4A1' : '#2a2a4a',
                    borderRadius: '3px 3px 0 0',
                    opacity: i % 2 === 0 ? 0.9 : 1,
                  }} />
                ))}
              </div>
            </div>

            {/* Card 4 — Conversion */}
            <div className="dash-card" style={{
              width: 196,
              top: '42%', right: '3%',
              transform: 'rotate(3.5deg)',
              zIndex: 4,
              animation: 'gf4 4.5s 2.4s ease-in-out infinite',
            }}>
              <div className="card-label">
                <span className="card-dot" style={{ background: '#3b82f6', animation: 'dblink 2s 2.1s ease-in-out infinite' }}></span>
                Conversion
              </div>
              <div className="card-val" style={{ fontSize: 26 }}>78.19%</div>
              <div className="card-pos">↑ +1.25% this week</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <div style={{ position: 'relative', width: 40, height: 40, flexShrink: 0 }}>
                  <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831"
                      fill="none" stroke="#6C63FF" strokeWidth="4" strokeDasharray="75,100" />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#a0a0c0' }}>75%</div>
                </div>
                <div style={{ fontSize: 10, color: '#6a6a8a' }}>78% conversion<br />rate overall</div>
              </div>
            </div>

            {/* Card 5 — Activity (bottom center, overlapping row above) */}
            <div className="dash-card" style={{
              width: 215,
              bottom: '7%', left: '50%',
              transform: 'translateX(-50%) rotate(-1.5deg)',
              zIndex: 5,
              animation: 'gf5 4.5s 3.2s ease-in-out infinite',
            }}>
              <div className="card-label">
                <span className="card-dot" style={{ background: '#00D4A1', animation: 'dblink 2s 0.35s ease-in-out infinite' }}></span>
                Activity
              </div>
              <div style={{ display: 'flex', gap: 22, marginBottom: 10 }}>
                <div>
                  <div className="card-val" style={{ fontSize: 18 }}>127<span className="card-muted" style={{ fontWeight: 400 }}>hrs</span></div>
                  <div className="card-muted">Consumed</div>
                </div>
                <div>
                  <div className="card-val" style={{ fontSize: 18 }}>80<span className="card-muted" style={{ fontWeight: 400 }}>mi</span></div>
                  <div className="card-muted">Remaining</div>
                </div>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 4 }}>
                <div style={{ height: '100%', width: '62%', background: 'linear-gradient(90deg,#f59e0b,#fbbf24)', borderRadius: 3 }} />
              </div>
              <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '38%', background: 'linear-gradient(90deg,#6C63FF,#9b93ff)', borderRadius: 3 }} />
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 9, color: '#6a6a8a' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}></span>Queries 62%
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#6C63FF', display: 'inline-block' }}></span>Reports 38%
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}