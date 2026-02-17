/**
 * Pure SVG radar chart for 5 axes.
 * Axes: Model Selection, Prompt Efficiency, Debugging, Multi-Model, Real-World.
 * Values 0-100. Grid rings + filled data polygon with accent color.
 */

interface RadarChartProps {
  data: {
    modelSelection: number;
    promptEfficiency: number;
    debugging: number;
    multiModel: number;
    realWorld: number;
  };
  size?: number;
  accentColor?: string;
}

const LABELS = ['Model Selection', 'Prompt Efficiency', 'Debugging', 'Multi-Model', 'Real-World'];
const AXES = ['modelSelection', 'promptEfficiency', 'debugging', 'multiModel', 'realWorld'] as const;
const RINGS = [25, 50, 75, 100];

function polarToCartesian(cx: number, cy: number, radius: number, angleIndex: number, total: number) {
  const angle = (Math.PI * 2 * angleIndex) / total - Math.PI / 2;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

export function RadarChart({ data, size = 280, accentColor = '#c9a962' }: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.38;
  const n = AXES.length;

  // Grid rings
  const ringPaths = RINGS.map((ring) => {
    const r = (ring / 100) * maxR;
    const points = Array.from({ length: n }, (_, i) => {
      const p = polarToCartesian(cx, cy, r, i, n);
      return `${p.x},${p.y}`;
    });
    return points.join(' ');
  });

  // Axis lines
  const axisLines = Array.from({ length: n }, (_, i) => {
    const p = polarToCartesian(cx, cy, maxR, i, n);
    return { x1: cx, y1: cy, x2: p.x, y2: p.y };
  });

  // Data polygon
  const dataPoints = AXES.map((key, i) => {
    const value = Math.min(100, Math.max(0, data[key] || 0));
    const r = (value / 100) * maxR;
    const p = polarToCartesian(cx, cy, r, i, n);
    return `${p.x},${p.y}`;
  });

  // Label positions
  const labelPositions = LABELS.map((label, i) => {
    const p = polarToCartesian(cx, cy, maxR + 20, i, n);
    return { label, x: p.x, y: p.y };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid rings */}
      {ringPaths.map((points, i) => (
        <polygon
          key={i}
          points={points}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={1}
        />
      ))}

      {/* Axis lines */}
      {axisLines.map((line, i) => (
        <line
          key={i}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={1}
        />
      ))}

      {/* Data polygon */}
      <polygon
        points={dataPoints.join(' ')}
        fill={`${accentColor}30`}
        stroke={accentColor}
        strokeWidth={2}
      />

      {/* Data points */}
      {AXES.map((key, i) => {
        const value = Math.min(100, Math.max(0, data[key] || 0));
        const r = (value / 100) * maxR;
        const p = polarToCartesian(cx, cy, r, i, n);
        return (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill={accentColor} />
        );
      })}

      {/* Labels */}
      {labelPositions.map((pos, i) => (
        <text
          key={i}
          x={pos.x}
          y={pos.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(255,255,255,0.6)"
          fontSize={10}
          fontFamily="Menlo, Monaco, monospace"
        >
          {pos.label}
        </text>
      ))}
    </svg>
  );
}
