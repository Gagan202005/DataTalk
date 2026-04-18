import React, { useState, useEffect, useRef, useCallback } from 'react';
import Globe from 'react-globe.gl';
import { X, TrendingUp, TrendingDown, Minus, Globe2, Radio } from 'lucide-react';
import './FinancialGlobe.css';

// ─── Hard-coded financial news (April 18 2026) ────────────────────────────────
const NEWS = [
  {
    id: 1,
    headline: 'Iran Opens Strait of Hormuz',
    description: "Iran's foreign minister announced the Strait of Hormuz is open to all shipping during the Israel-Lebanon ceasefire, triggering an 11% single-day crash in oil prices.",
    location: 'Strait of Hormuz, Iran',
    lat: 26.5667,
    lng: 56.25,
    category: 'Commodities',
    severity: 'critical',
    time: '9m ago',
  },
  {
    id: 2,
    headline: 'Brent Crude Near $96 After Extreme Volatility',
    description: 'Brent crude trades at ~$95.77/barrel after whipsawing between $100 and $84 as the US Navy blockade of Iranian ports collapsed and a ceasefire was announced.',
    location: 'London, UK',
    lat: 51.5074,
    lng: -0.1278,
    category: 'Commodities',
    severity: 'critical',
    time: '22m ago',
  },
  {
    id: 3,
    headline: 'Gold Hits $4,867 — Fourth Consecutive Weekly Record',
    description: 'Gold reached a fresh record high of $4,867/oz, up 41.7% year-over-year, driven by safe-haven demand amid the Middle East conflict.',
    location: 'New York, USA',
    lat: 40.7128,
    lng: -74.006,
    category: 'Commodities',
    severity: 'warning',
    time: '35m ago',
  },
  {
    id: 4,
    headline: 'S&P 500 & Nasdaq Hit Fresh 2026 Records',
    description: 'US equities surged on ceasefire optimism — S&P 500 rose to 7,126 (+1.20%). Nasdaq extended its winning streak to 12 consecutive days, the longest in history.',
    location: 'New York, USA',
    lat: 40.85,
    lng: -73.8,
    category: 'Markets',
    severity: 'info',
    time: '41m ago',
  },
  {
    id: 5,
    headline: 'IMF Cuts Global Growth to 3.1% — "Shadow of War"',
    description: "IMF's April WEO slashed global growth to 3.1% for 2026, warning a severe energy crisis scenario could push growth to 2% with inflation exceeding 6%.",
    location: 'Washington D.C., USA',
    lat: 38.9072,
    lng: -77.0369,
    category: 'Markets',
    severity: 'critical',
    time: '1h ago',
  },
  {
    id: 6,
    headline: 'Netflix Plunges 10.8% After Earnings Miss',
    description: 'Netflix stock fell 10.8% after Q1 2026 earnings failed to deliver upgraded guidance despite recent price hikes; analysts had expected EPS of $0.76.',
    location: 'Los Angeles, USA',
    lat: 34.0522,
    lng: -118.2437,
    category: 'Markets',
    severity: 'warning',
    time: '1h ago',
  },
  {
    id: 7,
    headline: 'Saudi Arabia Oil Output Collapses 23%',
    description: 'Saudi production fell from 10.1 mb/d to 7.8 mb/d as Gulf Arab states cannot export through the blocked Strait of Hormuz; East-West pipeline also struck.',
    location: 'Riyadh, Saudi Arabia',
    lat: 24.7136,
    lng: 46.6753,
    category: 'Commodities',
    severity: 'critical',
    time: '2h ago',
  },
  {
    id: 8,
    headline: 'US Dollar Index Falls to 97.7 — Third Weekly Loss',
    description: 'The DXY dropped to 97.70 as improving Middle East peace prospects reduced safe-haven demand for the dollar and eased energy-driven inflation fears.',
    location: 'New York, USA',
    lat: 40.6,
    lng: -74.3,
    category: 'FX',
    severity: 'warning',
    time: '2h ago',
  },
  {
    id: 9,
    headline: 'China Yuan Hits 6.83 — Strongest Since 2023',
    description: "The Chinese yuan strengthened to 6.83 per USD, its highest level since March 2023, as China's Q1 2026 GDP beat expectations at 5.0% growth.",
    location: 'Beijing, China',
    lat: 39.9042,
    lng: 116.4074,
    category: 'FX',
    severity: 'info',
    time: '3h ago',
  },
  {
    id: 10,
    headline: 'China Q1 GDP Grows 5.0%, Beats Forecasts',
    description: "China's economy expanded 5.0% YoY in Q1 2026, surpassing the 4.8% consensus, with 15% year-on-year foreign trade growth.",
    location: 'Beijing, China',
    lat: 40.2,
    lng: 116.8,
    category: 'Markets',
    severity: 'info',
    time: '3h ago',
  },
  {
    id: 11,
    headline: 'Fed Holds Rates at 3.5–3.75% Amid War Uncertainty',
    description: 'The Federal Reserve held its benchmark rate steady for a second consecutive meeting, citing renewed supply-side inflation from the energy crisis.',
    location: 'Washington D.C., USA',
    lat: 38.7,
    lng: -77.2,
    category: 'Central Bank',
    severity: 'warning',
    time: '4h ago',
  },
  {
    id: 12,
    headline: 'ECB Signals Rate Pause for All of 2026',
    description: 'The ECB signalled it is effectively done cutting rates for 2026 as energy-driven inflation from the Hormuz crisis offsets weak eurozone demand.',
    location: 'Frankfurt, Germany',
    lat: 50.1109,
    lng: 8.6821,
    category: 'Central Bank',
    severity: 'warning',
    time: '4h ago',
  },
  {
    id: 13,
    headline: 'Bank of Japan Holds at 0.75%',
    description: 'The BoJ left rates unchanged at 0.75%, pausing its hiking cycle amid global uncertainty; next policy decision April 27-28.',
    location: 'Tokyo, Japan',
    lat: 35.6762,
    lng: 139.6503,
    category: 'Central Bank',
    severity: 'info',
    time: '5h ago',
  },
  {
    id: 14,
    headline: 'Bitcoin Stabilises Near $74,000',
    description: 'Bitcoin traded around $74,365 after volatility — dropped to $70,600 during US Navy blockade announcement then rebounded with broader risk assets.',
    location: 'New York, USA',
    lat: 40.9,
    lng: -73.6,
    category: 'Crypto',
    severity: 'warning',
    time: '5h ago',
  },
  {
    id: 15,
    headline: 'Kering (Gucci) Crashes 9.3% on Weak Sales',
    description: 'French luxury group Kering fell to the bottom of the Stoxx 600 after Gucci sales missed expectations, reflecting weakening luxury demand in China and Europe.',
    location: 'Paris, France',
    lat: 48.8566,
    lng: 2.3522,
    category: 'Markets',
    severity: 'warning',
    time: '5h ago',
  },
  {
    id: 16,
    headline: 'Israel-Lebanon 10-Day Ceasefire Declared',
    description: 'Israel and Lebanon formally entered a 10-day ceasefire, triggering sharp rallies in global equities and a plunge in oil prices globally.',
    location: 'Tel Aviv, Israel',
    lat: 32.0853,
    lng: 34.7818,
    category: 'Markets',
    severity: 'critical',
    time: '6h ago',
  },
  {
    id: 17,
    headline: 'Fertilizer Prices Surge 30–40% on Hormuz Disruption',
    description: "Global fertilizer prices spiked 30–40% as the Hormuz closure cut key supply chains; UNCTAD warns of food security risks in developing nations.",
    location: 'Vienna, Austria',
    lat: 48.2082,
    lng: 16.3738,
    category: 'Commodities',
    severity: 'critical',
    time: '6h ago',
  },
  {
    id: 18,
    headline: 'RBA Hikes to 4.10% — Only Major CB to Raise',
    description: 'The Reserve Bank of Australia raised its cash rate by 25bps to 4.10% in a tight 5-4 vote, citing stubbornly elevated domestic inflation.',
    location: 'Sydney, Australia',
    lat: -33.8688,
    lng: 151.2093,
    category: 'Central Bank',
    severity: 'warning',
    time: '7h ago',
  },
  {
    id: 19,
    headline: 'EU-India Trade Deal in Final Stages',
    description: "The EU's trade agreement with India is progressing toward finalisation, part of a broader realignment of trade flows as Middle East conflict disrupts supply chains.",
    location: 'Brussels, Belgium',
    lat: 50.8503,
    lng: 4.3517,
    category: 'Trade',
    severity: 'info',
    time: '8h ago',
  },
  {
    id: 20,
    headline: 'Private Credit Distressed Debt Surges — Bank Spillover Risk',
    description: 'Private credit industry sees sharp rise in distressed debt in 2026; analysts warn deterioration could spill over into traditional banking, increasing systemic risk.',
    location: 'London, UK',
    lat: 51.3,
    lng: -0.3,
    category: 'Banking',
    severity: 'warning',
    time: '9h ago',
  },
];

const COMMODITIES = [
  { label: 'WTI Crude', value: '$78.34', change: '+1.6%', up: true },
  { label: 'Brent Crude', value: '$95.77', change: '-0.6%', up: false },
  { label: 'Natural Gas', value: '$2.18', change: '+1.4%', up: true },
  { label: 'Gold', value: '$4,867', change: '+0.9%', up: true },
  { label: 'Silver', value: '$31.42', change: '+0.3%', up: true },
  { label: 'Wheat', value: '$542.00', change: '-0.8%', up: false },
  { label: 'Corn', value: '$448.75', change: '+0.5%', up: true },
  { label: 'Bitcoin', value: '$74,365', change: '+2.1%', up: true },
  { label: 'S&P 500', value: '7,126', change: '+1.2%', up: true },
  { label: 'Nasdaq', value: '23,841', change: '+1.8%', up: true },
  { label: 'DXY', value: '97.70', change: '-0.4%', up: false },
  { label: 'EUR/USD', value: '1.0921', change: '+0.3%', up: true },
];

const SEVERITY_COLOR = {
  critical: '#ef4444',
  warning:  '#f59e0b',
  info:     '#22c55e',
};

const CATEGORY_COLOR = {
  Markets:      '#3b82f6',
  Commodities:  '#f59e0b',
  'Central Bank': '#a855f7',
  FX:           '#06b6d4',
  Banking:      '#ec4899',
  Crypto:       '#8b5cf6',
  Trade:        '#22c55e',
};

export default function FinancialGlobe({ isOpen, onClose }) {
  const globeRef                      = useRef();
  const [selectedNews, setSelectedNews] = useState(null);
  const [hoveredNews, setHoveredNews]   = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');
  const [tick, setTick]               = useState(0);       // drives pulse animation
  const [globeReady, setGlobeReady]   = useState(false);
  const [dimensions, setDimensions]   = useState({ w: 0, h: 0 });
  const containerRef                  = useRef();

  // Pulse ticker
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 800);
    return () => clearInterval(id);
  }, []);

  // Measure container
  useEffect(() => {
    if (!isOpen) return;
    const measure = () => {
      if (containerRef.current) {
        const r = containerRef.current.getBoundingClientRect();
        setDimensions({ w: r.width, h: r.height });
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [isOpen]);

  // Auto-rotate
  useEffect(() => {
    if (!globeRef.current || !globeReady) return;
    const controls = globeRef.current.controls();
    controls.autoRotate      = true;
    controls.autoRotateSpeed = 0.4;
    controls.enableZoom      = true;
    controls.minDistance     = 180;
    controls.maxDistance     = 500;
  }, [globeReady]);

  // Focus on clicked news
  const focusOn = useCallback((lat, lng) => {
    if (!globeRef.current) return;
    globeRef.current.controls().autoRotate = false;
    globeRef.current.pointOfView({ lat, lng, altitude: 1.8 }, 800);
    setTimeout(() => {
      if (globeRef.current) globeRef.current.controls().autoRotate = true;
    }, 4000);
  }, []);

  const categories  = ['All', ...Array.from(new Set(NEWS.map(n => n.category)))];
  const filtered    = activeFilter === 'All' ? NEWS : NEWS.filter(n => n.category === activeFilter);
  const criticalCount = NEWS.filter(n => n.severity === 'critical').length;

  if (!isOpen) return null;

  return (
    <div className="fg-backdrop">
      <div className="fg-overlay">

        {/* ── TOP HEADER ────────────────────────────────────── */}
        <div className="fg-header">
          <div className="fg-header-left">
            <Globe2 size={16} className="fg-header-icon" />
            <span className="fg-title">FINANCIAL NEWS</span>
            <span className="fg-live-dot" />
            <span className="fg-live-label">LIVE TRACKING</span>
            <span className="fg-critical-badge">{criticalCount} CRITICAL</span>
          </div>
          <div className="fg-header-right">
            <span className="fg-date">APR 18, 2026 · {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} UTC</span>
            <button className="fg-close" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        {/* ── BODY ──────────────────────────────────────────── */}
        <div className="fg-body">

          {/* LEFT PANEL — news feed */}
          <div className="fg-left-panel">
            <div className="fg-panel-header">
              <Radio size={11} className="fg-panel-radio" />
              LATEST NEWS
            </div>

            {/* Category filters */}
            <div className="fg-filters">
              {categories.map(c => (
                <button
                  key={c}
                  className={`fg-filter-btn${activeFilter === c ? ' active' : ''}`}
                  onClick={() => setActiveFilter(c)}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* News list */}
            <div className="fg-news-list">
              {filtered.map(news => (
                <div
                  key={news.id}
                  className={`fg-news-item${selectedNews?.id === news.id ? ' selected' : ''} severity-${news.severity}`}
                  onClick={() => {
                    setSelectedNews(news);
                    focusOn(news.lat, news.lng);
                  }}
                >
                  <div className="fg-news-top">
                    <span
                      className="fg-severity-dot"
                      style={{
                        background: SEVERITY_COLOR[news.severity],
                        boxShadow: news.severity === 'critical'
                          ? `0 0 ${tick % 2 === 0 ? 6 : 3}px ${SEVERITY_COLOR.critical}`
                          : 'none',
                      }}
                    />
                    <span className="fg-news-category" style={{ color: CATEGORY_COLOR[news.category] }}>
                      {news.category}
                    </span>
                    <span className="fg-news-time">{news.time}</span>
                  </div>
                  <div className="fg-news-headline">{news.headline}</div>
                  {selectedNews?.id === news.id && (
                    <div className="fg-news-desc">{news.description}</div>
                  )}
                  <div className="fg-news-location">📍 {news.location}</div>
                </div>
              ))}
            </div>
          </div>

          {/* CENTER — globe */}
          <div className="fg-globe-area" ref={containerRef}>
            {dimensions.w > 0 && (
              <Globe
                ref={globeRef}
                width={dimensions.w}
                height={dimensions.h}
                onGlobeReady={() => setGlobeReady(true)}

                // Textures
                globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
                bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"

                // Atmosphere
                showAtmosphere
                atmosphereColor="#ff2200"
                atmosphereAltitude={0.12}

                // Points
                pointsData={NEWS}
                pointLat="lat"
                pointLng="lng"
                pointColor={d => SEVERITY_COLOR[d.severity]}
                pointRadius={d => {
                  const base = d.severity === 'critical' ? 0.6 : d.severity === 'warning' ? 0.45 : 0.3;
                  // pulse critical
                  return d.severity === 'critical'
                    ? base + (tick % 2 === 0 ? 0.15 : 0)
                    : base;
                }}
                pointAltitude={0.01}
                pointResolution={12}
                pointLabel={d => `
                  <div style="
                    background: #0d0d0d;
                    border: 1px solid ${SEVERITY_COLOR[d.severity]};
                    border-radius: 8px;
                    padding: 10px 14px;
                    font-family: 'JetBrains Mono', monospace;
                    max-width: 260px;
                    color: #e5e7eb;
                    box-shadow: 0 4px 24px rgba(0,0,0,0.8);
                  ">
                    <div style="color:${SEVERITY_COLOR[d.severity]};font-size:10px;font-weight:700;letter-spacing:0.1em;margin-bottom:4px;">
                      ${d.category.toUpperCase()} · ${d.severity.toUpperCase()}
                    </div>
                    <div style="font-size:13px;font-weight:600;margin-bottom:6px;line-height:1.4;">${d.headline}</div>
                    <div style="font-size:11px;color:#9ca3af;line-height:1.5;">${d.description}</div>
                    <div style="font-size:10px;color:#6b7280;margin-top:6px;">📍 ${d.location}</div>
                  </div>
                `}
                onPointClick={d => {
                  setSelectedNews(d);
                  focusOn(d.lat, d.lng);
                }}
                onPointHover={d => setHoveredNews(d)}

                // Rings for critical events
                ringsData={NEWS.filter(n => n.severity === 'critical')}
                ringLat="lat"
                ringLng="lng"
                ringColor={() => SEVERITY_COLOR.critical}
                ringMaxRadius={4}
                ringPropagationSpeed={2}
                ringRepeatPeriod={700}
                ringAltitude={0.005}
              />
            )}

            {/* Selected news card overlay on globe */}
            {selectedNews && (
              <div className="fg-selected-card">
                <div className="fg-selected-top">
                  <span className="fg-selected-cat" style={{ color: CATEGORY_COLOR[selectedNews.category] }}>
                    {selectedNews.category}
                  </span>
                  <span className="fg-selected-sev" style={{ color: SEVERITY_COLOR[selectedNews.severity] }}>
                    ● {selectedNews.severity.toUpperCase()}
                  </span>
                  <button className="fg-selected-close" onClick={() => setSelectedNews(null)}>
                    <X size={12} />
                  </button>
                </div>
                <div className="fg-selected-headline">{selectedNews.headline}</div>
                <div className="fg-selected-desc">{selectedNews.description}</div>
                <div className="fg-selected-meta">
                  📍 {selectedNews.location} · {selectedNews.time}
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="fg-legend">
              {Object.entries(SEVERITY_COLOR).map(([sev, col]) => (
                <div key={sev} className="fg-legend-item">
                  <span className="fg-legend-dot" style={{ background: col }} />
                  <span>{sev.charAt(0).toUpperCase() + sev.slice(1)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT PANEL — market data */}
          <div className="fg-right-panel">
            <div className="fg-panel-header">
              <Radio size={11} className="fg-panel-radio" />
              MARKETS
            </div>
            <div className="fg-commodities">
              {COMMODITIES.map(c => (
                <div key={c.label} className="fg-commodity-row">
                  <span className="fg-commodity-label">{c.label}</span>
                  <span className="fg-commodity-value">{c.value}</span>
                  <span className={`fg-commodity-change ${c.up ? 'up' : 'down'}`}>
                    {c.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {c.change}
                  </span>
                </div>
              ))}
            </div>

            {/* Category breakdown */}
            <div className="fg-panel-header" style={{ marginTop: 16 }}>BREAKDOWN</div>
            <div className="fg-breakdown">
              {Object.entries(
                NEWS.reduce((acc, n) => {
                  acc[n.severity] = (acc[n.severity] || 0) + 1;
                  return acc;
                }, {})
              ).map(([sev, count]) => (
                <div key={sev} className="fg-breakdown-row">
                  <span className="fg-breakdown-dot" style={{ background: SEVERITY_COLOR[sev] }} />
                  <span className="fg-breakdown-label">{sev}</span>
                  <div className="fg-breakdown-bar-wrap">
                    <div
                      className="fg-breakdown-bar"
                      style={{ width: `${(count / NEWS.length) * 100}%`, background: SEVERITY_COLOR[sev] }}
                    />
                  </div>
                  <span className="fg-breakdown-count">{count}</span>
                </div>
              ))}
            </div>

            {/* Category list */}
            <div className="fg-panel-header" style={{ marginTop: 16 }}>BY CATEGORY</div>
            <div className="fg-cat-list">
              {Object.entries(
                NEWS.reduce((acc, n) => {
                  acc[n.category] = (acc[n.category] || 0) + 1;
                  return acc;
                }, {})
              ).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                <div
                  key={cat}
                  className={`fg-cat-row${activeFilter === cat ? ' active' : ''}`}
                  onClick={() => setActiveFilter(prev => prev === cat ? 'All' : cat)}
                >
                  <span className="fg-cat-dot" style={{ background: CATEGORY_COLOR[cat] }} />
                  <span className="fg-cat-name">{cat}</span>
                  <span className="fg-cat-count">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── BOTTOM TICKER ─────────────────────────────────── */}
        <div className="fg-ticker-wrap">
          <div className="fg-ticker-label">LIVE</div>
          <div className="fg-ticker-track">
            <div className="fg-ticker-inner">
              {[...COMMODITIES, ...COMMODITIES].map((c, i) => (
                <span key={i} className="fg-ticker-item">
                  <span className="fg-ticker-name">{c.label}</span>
                  <span className="fg-ticker-val">{c.value}</span>
                  <span className={`fg-ticker-chg ${c.up ? 'up' : 'down'}`}>{c.change}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
