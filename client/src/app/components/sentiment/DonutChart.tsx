interface DonutSegment {
  name: string;
  value: number;
  color: string;
}

/** Lightweight, accessible donut for simple distributions. This avoids
 * shipping a full charting runtime for three static sentiment slices. */
export function DonutChart({ segments, size = 112, isDark = false }: { segments: DonutSegment[]; size?: number; isDark?: boolean }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  let cursor = 0;
  const stops = total > 0
    ? segments.map((segment) => {
        const start = cursor;
        cursor += (segment.value / total) * 100;
        return `${segment.color} ${start}% ${cursor}%`;
      }).join(', ')
    : `${isDark ? '#334155' : '#e5e7eb'} 0 100%`;
  const label = total > 0
    ? segments.map((segment) => `${segment.name}: ${segment.value} (${Math.round(segment.value / total * 100)}%)`).join(', ')
    : 'No sentiment data';

  return (
    <div className="flex justify-center py-2">
      <div
        role="img"
        aria-label={label}
        className="grid place-items-center rounded-full"
        style={{ width: size, height: size, background: `conic-gradient(${stops})` }}
      >
        <div
          aria-hidden="true"
          className={`rounded-full ${isDark ? 'bg-slate-900' : 'bg-white'}`}
          style={{ width: Math.round(size * 0.52), height: Math.round(size * 0.52) }}
        />
      </div>
    </div>
  );
}
