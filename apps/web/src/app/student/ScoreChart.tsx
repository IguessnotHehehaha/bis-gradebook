import { getT } from "@/lib/i18n/server";
import { MAX_SCORE, PASS_MARK, isLow } from "@gradebook/shared";

export interface ChartPoint {
  label: string;
  date: string;
  score: number;
}

const W = 360;
const H = 220;
const PAD = { top: 14, right: 14, bottom: 34, left: 34 };

/** Dependency-free SVG chart: one bar per assessment, with the pass mark as a dashed line. */
export async function ScoreChart({ points, courseName }: { points: ChartPoint[]; courseName: string }) {
  const { t } = await getT();
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + innerH - (v / MAX_SCORE) * innerH;
  const slot = innerW / Math.max(points.length, 1);
  const barW = Math.min(44, slot * 0.6);
  const ticks = [0, 25, 50, 75, 100];
  const summary = points.map((p) => `${p.label}: ${p.score}`).join(", ");

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("chart.aria", { course: courseName, summary })}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" className="chart-axis">{t}</text>
          </g>
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(PASS_MARK)} y2={y(PASS_MARK)} className="chart-pass" />
        <text x={W - PAD.right} y={y(PASS_MARK) - 4} textAnchor="end" className="chart-pass-label">
          {t("chart.passMark", { mark: PASS_MARK })}
        </text>
        {points.map((p, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          const top = y(p.score);
          const name = p.label.length > 10 ? p.label.slice(0, 9) + "…" : p.label;
          return (
            <g key={i}>
              <title>{`${p.label} (${p.date}): ${p.score}`}</title>
              <rect
                x={cx - barW / 2}
                y={top}
                width={barW}
                height={Math.max(y(0) - top, 1)}
                rx={3}
                className={isLow(p.score) ? "chart-bar low" : "chart-bar"}
              />
              <text x={cx} y={top - 4} textAnchor="middle" className="chart-value">{p.score}</text>
              <text x={cx} y={H - PAD.bottom + 14} textAnchor="middle" className="chart-axis">{name}</text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
