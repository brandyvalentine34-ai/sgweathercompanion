import React from 'react';
import { RegionReading } from '../types/airQuality';

interface SubIndexRadarChartProps {
  reading: RegionReading;
  colorHex: string;
}

/**
 * Scientific 6-axis polygonal spider/radar chart for inspecting NEA pollutant sub-indices
 * and concentrations in the active Singapore sector.
 */
export const SubIndexRadarChart: React.FC<SubIndexRadarChartProps> = ({
  reading,
  colorHex,
}) => {
  const size = 240;
  const center = size / 2;
  const maxRadius = 78;

  // Normalize each pollutant reading against a 200 scale ceiling for visual radar balance
  const axes = [
    { label: 'PM2.5 (1h)', value: reading.pm25OneHr, unit: 'µg/m³', max: 200 },
    { label: 'PM2.5 Sub', value: reading.pm25SubIndex, unit: 'idx', max: 200 },
    { label: 'PM10 Sub', value: reading.pm10SubIndex, unit: 'idx', max: 200 },
    { label: 'O₃ Sub', value: reading.o3SubIndex, unit: 'idx', max: 120 },
    { label: 'NO₂ (1h)', value: reading.no2OneHrMax, unit: 'µg/m³', max: 100 },
    { label: 'SO₂ Sub', value: reading.so2SubIndex, unit: 'idx', max: 60 },
  ];

  const getPoint = (index: number, normalizedRatio: number) => {
    const angle = (Math.PI * 2 * index) / axes.length - Math.PI / 2;
    const r = Math.max(0.08, Math.min(1, normalizedRatio)) * maxRadius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const rings = [0.25, 0.5, 0.75, 1.0];

  const dataPoints = axes.map((axis, idx) =>
    getPoint(idx, axis.value / axis.max)
  );
  const polygonPoints = dataPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible select-none"
        role="img"
        aria-label={`Pollutant radar profile for ${reading.label}`}
      >
        {/* Polygonal Concentric Grid */}
        {rings.map((ring) => {
          const pts = axes
            .map((_, idx) => {
              const p = getPoint(idx, ring);
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            })
            .join(' ');
          return (
            <polygon
              key={ring}
              points={pts}
              fill="none"
              stroke="#1E293B"
              strokeWidth="1"
              strokeDasharray={ring === 1 ? undefined : '2 2'}
            />
          );
        })}

        {/* Radial Axes & Vertex Labels */}
        {axes.map((axis, idx) => {
          const outer = getPoint(idx, 1.0);
          const labelPos = getPoint(idx, 1.28);
          return (
            <g key={axis.label}>
              <line
                x1={center}
                y1={center}
                x2={outer.x}
                y2={outer.y}
                stroke="#1E293B"
                strokeWidth="1"
              />
              <text
                x={labelPos.x}
                y={labelPos.y - 4}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-slate-400 font-mono text-[10px]"
              >
                {axis.label}
              </text>
              <text
                x={labelPos.x}
                y={labelPos.y + 8}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-slate-200 font-mono text-[10px] font-semibold"
              >
                {axis.value}
              </text>
            </g>
          );
        })}

        {/* Active Pollutant Polygon */}
        <polygon
          points={polygonPoints}
          fill={colorHex}
          fillOpacity={0.22}
          stroke={colorHex}
          strokeWidth="2"
        />

        {/* Vertex Nodes */}
        {dataPoints.map((pt, idx) => (
          <circle
            key={idx}
            cx={pt.x}
            cy={pt.y}
            r="3.5"
            fill="#07090E"
            stroke={colorHex}
            strokeWidth="2"
          />
        ))}
      </svg>
    </div>
  );
};
