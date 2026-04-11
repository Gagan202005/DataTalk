import React from 'react';
import {
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  ScatterChart, Scatter,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { BarChart3 } from 'lucide-react';

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16'];

const tooltipStyle = {
  backgroundColor: '#1f2937',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  color: '#f1f5f9',
  fontSize: '12px',
  padding: '8px 12px',
};

const axisStyle = {
  stroke: '#94a3b8',
  fontSize: 11,
  fontFamily: 'Inter, sans-serif',
};

const gridStyle = {
  strokeDasharray: '3 3',
  stroke: 'rgba(255,255,255,0.07)',
};

export default function ChartRenderer({ chart, matplotlib_image }) {
  // If we have a matplotlib base64 image, render that instead
  if (matplotlib_image) {
    return (
      <div className="my-3 rounded-xl overflow-hidden border border-[rgba(255,255,255,0.08)] bg-[#111827]/60">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[rgba(255,255,255,0.06)] text-xs text-[#94a3b8]">
          <BarChart3 size={13} />
          <span className="font-medium">Chart Output</span>
        </div>
        <div className="p-2 flex justify-center">
          <img
            src={`data:image/png;base64,${matplotlib_image}`}
            alt="Chart"
            className="max-w-full h-auto rounded-lg"
            loading="lazy"
            style={{ maxHeight: '400px' }}
          />
        </div>
      </div>
    );
  }

  // No chart data
  if (!chart || !chart.data || chart.data.length === 0) return null;

  const { type, data, x_key, y_key, title } = chart;

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-[rgba(255,255,255,0.08)] bg-[#111827]/60">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[rgba(255,255,255,0.06)] text-xs text-[#94a3b8]">
        <BarChart3 size={13} className="text-[#8b5cf6]" />
        <span className="font-medium">{title || 'Chart'}</span>
        <span className="ml-auto text-[10px] text-[#64748b]">{type}</span>
      </div>

      {/* Chart Area */}
      <div className="p-4" style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart(type, data, x_key, y_key)}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function renderChart(type, data, x_key, y_key) {
  const yKeys = Array.isArray(y_key) ? y_key : [y_key];

  // Rotate x-axis labels if many data points to prevent overlap
  const xAxisProps = {
    ...axisStyle,
    dataKey: x_key,
    ...(data.length > 10 ? {
      angle: -35,
      textAnchor: 'end',
      height: 55,
      interval: 0,
    } : {}),
  };

  // Format large Y-axis numbers compactly (e.g. 1500 → 1.5k)
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
          <YAxis {...axisStyle} tickFormatter={yAxisFormatter} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
          {yKeys.map((key, i) => (
            <Bar
              key={key}
              dataKey={key}
              fill={CHART_COLORS[i % CHART_COLORS.length]}
              radius={[4, 4, 0, 0]}
              maxBarSize={50}
            />
          ))}
        </BarChart>
      );

    case 'line':
      return (
        <LineChart data={data} margin={{ bottom: data.length > 10 ? 30 : 5 }}>
          <CartesianGrid {...gridStyle} />
          <XAxis {...xAxisProps} />
          <YAxis {...axisStyle} tickFormatter={yAxisFormatter} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
          {yKeys.map((key, i) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3, fill: CHART_COLORS[i % CHART_COLORS.length] }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      );

    case 'area':
      return (
        <AreaChart data={data} margin={{ bottom: data.length > 10 ? 30 : 5 }}>
          <CartesianGrid {...gridStyle} />
          <XAxis {...xAxisProps} />
          <YAxis {...axisStyle} tickFormatter={yAxisFormatter} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
          {yKeys.map((key, i) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              fill={CHART_COLORS[i % CHART_COLORS.length]}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      );

    case 'pie':
      return (
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            dataKey={yKeys[0]}
            nameKey={x_key}
            paddingAngle={2}
            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
            labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
        </PieChart>
      );

    case 'scatter':
      return (
        <ScatterChart>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey={x_key} name={x_key} {...axisStyle} />
          <YAxis dataKey={yKeys[0]} name={yKeys[0]} {...axisStyle} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3' }} />
          <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
          <Scatter name={yKeys[0]} data={data} fill={CHART_COLORS[0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Scatter>
        </ScatterChart>
      );

    default:
      // Fallback to bar chart
      return (
        <BarChart data={data}>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey={x_key} {...axisStyle} />
          <YAxis {...axisStyle} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
          {yKeys.map((key, i) => (
            <Bar key={key} dataKey={key} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      );
  }
}
