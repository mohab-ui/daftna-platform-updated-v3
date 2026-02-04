"use client";

import { useMemo } from "react";

type Props = {
  /** Scores as percentages (0-100). Order matters (oldest → newest). */
  scores: number[];
  height?: number;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function toNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Smooth SVG path (Catmull-Rom → Bezier).
 * Produces a nicer "professional" curve without external libs.
 */
function smoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length < 2) return "";

  const p = points;
  const d: string[] = [];
  d.push(`M ${p[0].x.toFixed(2)} ${p[0].y.toFixed(2)}`);

  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] ?? p2;

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    d.push(
      `C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x.toFixed(
        2
      )} ${p2.y.toFixed(2)}`
    );
  }

  return d.join(" ");
}

export default function PerformanceChart({ scores, height = 180 }: Props) {
  const safe = useMemo(() => scores.map((s) => clamp(toNum(s), 0, 100)), [scores]);

  const { d, area, points, has, lastLabel } = useMemo(() => {
    if (safe.length < 2) {
      return { d: "", area: "", points: [], has: false, lastLabel: null as any };
    }

    const w = 420;
    const h = height;

    const padX = 34; // room for labels
    const padY = 22;

    const baseY = h - padY;
    const xStep = (w - padX * 2) / (safe.length - 1);

    const y = (val: number) => {
      // 0 is bottom, 100 is top
      const t = val / 100;
      return baseY - t * (h - padY * 2);
    };

    const pts = safe.map((val, i) => ({
      x: padX + i * xStep,
      y: y(val),
      v: val,
    }));

    const line = smoothPath(pts);
    const areaPath = `M ${pts[0].x.toFixed(2)} ${baseY.toFixed(2)} L ${pts[0].x.toFixed(
      2
    )} ${pts[0].y.toFixed(2)} ${line.slice(1)} L ${pts[pts.length - 1].x.toFixed(
      2
    )} ${baseY.toFixed(2)} Z`;

    // last label bubble
    const last = pts[pts.length - 1];
    const label = `${Math.round(last.v)}%`;
    const labelW = clamp(label.length * 8 + 18, 44, 80);
    const labelH = 22;

    const lx = clamp(last.x + 10, 6, w - labelW - 6);
    const ly = clamp(last.y - labelH - 10, 6, h - labelH - 6);

    return {
      d: line,
      area: areaPath,
      points: pts,
      has: true,
      lastLabel: { x: lx, y: ly, w: labelW, h: labelH, text: label, px: last.x, py: last.y },
    };
  }, [safe, height]);

  if (!has) {
    return (
      <div className="chartEmpty">
        <div className="muted">محتاج محاولتين على الأقل علشان نرسم الأداء.</div>
      </div>
    );
  }

  const gridVals = [0, 25, 50, 75, 100];

  return (
    <div className="chartWrap" style={{ height }}>
      <svg viewBox={`0 0 420 ${height}`} preserveAspectRatio="none" className="chartSvg">
        <defs>
          <linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.20" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>

          <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* horizontal grid */}
        <g opacity="0.25" stroke="currentColor" strokeWidth="1">
          {gridVals.map((v) => {
            const y = (height - 22) - (v / 100) * (height - 44);
            return (
              <line
                key={v}
                x1="34"
                x2="410"
                y1={y}
                y2={y}
                strokeDasharray={v === 0 ? "0" : "4 6"}
              />
            );
          })}
        </g>

        {/* y-axis labels */}
        <g fill="currentColor" opacity="0.55" fontSize="10">
          <text x="6" y={height - 22} dominantBaseline="middle">
            0
          </text>
          <text x="6" y={(height - 22) - 0.5 * (height - 44)} dominantBaseline="middle">
            50
          </text>
          <text x="6" y="22" dominantBaseline="middle">
            100
          </text>
        </g>

        {/* area */}
        <path d={area} fill="url(#areaFill)" />

        {/* shadow line */}
        <path d={d} fill="none" stroke="currentColor" strokeWidth="4.2" opacity="0.14" filter="url(#softGlow)" />

        {/* main line */}
        <path d={d} fill="none" stroke="currentColor" strokeWidth="2.8" />

        {/* points */}
        {points.map((p, i) => {
          const isLast = i === points.length - 1;
          return (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={isLast ? 4.6 : 3.4}
                fill="var(--panel)"
                stroke="currentColor"
                strokeWidth={isLast ? 2.2 : 1.8}
              />
              <title>{`${Math.round(p.v)}%`}</title>
            </g>
          );
        })}

        {/* last value bubble */}
        {lastLabel ? (
          <g>
            <line
              x1={lastLabel.px}
              y1={lastLabel.py}
              x2={lastLabel.x}
              y2={lastLabel.y + lastLabel.h / 2}
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.25"
            />
            <rect
              x={lastLabel.x}
              y={lastLabel.y}
              width={lastLabel.w}
              height={lastLabel.h}
              rx="11"
              ry="11"
              fill="var(--panel)"
              stroke="rgba(106,169,255,.35)"
            />
            <text
              x={lastLabel.x + lastLabel.w / 2}
              y={lastLabel.y + lastLabel.h / 2}
              dominantBaseline="middle"
              textAnchor="middle"
              fontSize="11"
              fill="currentColor"
              opacity="0.9"
              style={{ fontWeight: 800 }}
            >
              {lastLabel.text}
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}
