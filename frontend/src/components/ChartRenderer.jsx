import React from 'react';
import {
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  ScatterChart, Scatter,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { BarChart3, Sparkles } from 'lucide-react';

const CHART_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

/* Light-theme styles */
const tooltipStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #e5e3de',
  borderRadius: 8,
  color: '#1a1a1a',
  fontSize: 12,
  padding: '8px 12px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
};
const axisStyle = { stroke: '#9b9b9b', fontSize: 11, fontFamily: '"DM Sans", sans-serif' };
const gridStyle = { strokeDasharray: '3 3', stroke: 'rgba(0,0,0,0.06)' };

export default function ChartRenderer({ id, chart, matplotlib_image, onExplain }) {
  /* Matplotlib base64 image */
  if (matplotlib_image) {
    return (
      <div id={id} className="chart-container" style={{ marginTop: 12 }}>
        <div className="chart-container-header">
          <BarChart3 size={13} style={{ color: 'var(--accent)' }} />
          <span>Chart Output</span>
        </div>
        <div style={{ padding: '14px 14px 10px', display: 'flex', justifyContent: 'center', background: '#ffffff' }}>
          <img
            src={`data:image/png;base64,${matplotlib_image}`}
            alt="Chart"
            loading="lazy"
            style={{ maxWidth: '100%', height: 'auto', borderRadius: 8, maxHeight: 420 }}
          />
        </div>
      </div>
    );
  }

  if (!chart || !chart.data || chart.data.length === 0) return null;

  const { type, data, x_key, y_key, title } = chart;

  return (
    <div id={id} className="chart-container" style={{ marginTop: 12, background: '#ffffff' }}>
      <div className="chart-container-header">
        <BarChart3 size={13} style={{ color: 'var(--accent)' }} />
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{title || 'Chart'}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text-xmuted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{type}</span>
      </div>
      <div className="chart-container-body" style={{ height: 320, background: '#ffffff' }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart(type, data, x_key, y_key)}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function renderChart(type, data, x_key, y_key) {
  const yKeys = Array.isArray(y_key) ? y_key : [y_key];

  const xAxisProps = {
    ...axisStyle,
    dataKey: x_key,
    tick: { ...axisStyle },
    ...(data.length > 10 ? { angle: -35, textAnchor: 'end', height: 55, interval: 0 } : {}),
  };

  const yAxisFormatter = (v) => {
    if (typeof v !== 'number') return v;
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
    return v;
  };

  switch (type) {
    case 'bar':
      return (
        <BarChart data={data} margin={{ bottom: data.length > 10 ? 30 : 5 }}>
          <CartesianGrid {...gridStyle} />
          <XAxis {...xAxisProps} />
          <YAxis {...axisStyle} tick={{ ...axisStyle }} tickFormatter={yAxisFormatter} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(79,70,229,0.04)' }} />
          <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
          {yKeys.map((key, i) => (
            <Bar key={key} dataKey={key} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={50} />
          ))}
        </BarChart>
      );

    case 'line':
      return (
        <LineChart data={data} margin={{ bottom: data.length > 10 ? 30 : 5 }}>
          <CartesianGrid {...gridStyle} />
          <XAxis {...xAxisProps} />
          <YAxis {...axisStyle} tick={{ ...axisStyle }} tickFormatter={yAxisFormatter} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
          {yKeys.map((key, i) => (
            <Line key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          ))}
        </LineChart>
      );

    case 'area':
      return (
        <AreaChart data={data} margin={{ bottom: data.length > 10 ? 30 : 5 }}>
          <CartesianGrid {...gridStyle} />
          <XAxis {...xAxisProps} />
          <YAxis {...axisStyle} tick={{ ...axisStyle }} tickFormatter={yAxisFormatter} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
          {yKeys.map((key, i) => (
            <Area key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[i % CHART_COLORS.length]} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.1} strokeWidth={2.5} />
          ))}
        </AreaChart>
      );

    case 'pie':
      return (
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={65} outerRadius={105} dataKey={yKeys[0]} nameKey={x_key} paddingAngle={2}
            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
            labelLine={{ stroke: '#9b9b9b', strokeWidth: 1 }}
          >
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
        </PieChart>
      );

    case 'scatter':
      return (
        <ScatterChart>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey={x_key} name={x_key} {...axisStyle} tick={{ ...axisStyle }} />
          <YAxis dataKey={yKeys[0]} name={yKeys[0]} {...axisStyle} tick={{ ...axisStyle }} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3' }} />
          <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
          <Scatter name={yKeys[0]} data={data} fill={CHART_COLORS[0]}>
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Scatter>
        </ScatterChart>
      );

    default:
      return (
        <BarChart data={data}>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey={x_key} {...axisStyle} tick={{ ...axisStyle }} />
          <YAxis {...axisStyle} tick={{ ...axisStyle }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
          {yKeys.map((key, i) => (
            <Bar key={key} dataKey={key} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      );
  }
}
