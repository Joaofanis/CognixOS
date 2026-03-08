const COLORS = { A: "#a78bfa", B: "#4ade80" };

const DARK_CARD: React.CSSProperties = {
  background: "linear-gradient(145deg, rgba(12,12,24,0.97) 0%, rgba(18,16,36,0.97) 100%)",
  boxShadow: "0 0 0 1px rgba(139,92,246,0.12), 0 24px 64px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)",
  borderRadius: 24,
  overflow: "hidden",
};

interface Props {
  diffs: Array<{ trait: string; diff: number }>;
  nameA: string;
  nameB: string;
  title: string;
}

export default function CompareDiffBars({ diffs, nameA, nameB, title }: Props) {
  return (
    <div style={DARK_CARD} className="p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>{title}</p>
        <div className="flex gap-3 text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>
          <span style={{ color: COLORS.A }}>◀ {nameA}</span>
          <span style={{ color: COLORS.B }}>{nameB} ▶</span>
        </div>
      </div>
      <div className="space-y-2">
        {diffs.slice(0, 6).map((d) => (
          <div key={d.trait} className="flex items-center gap-3">
            <span className="text-xs w-32 shrink-0 truncate" style={{ color: "rgba(255,255,255,0.6)" }}>
              {d.trait}
            </span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.abs(d.diff) * 10}%`,
                  marginLeft: d.diff < 0 ? `${(10 - Math.abs(d.diff)) * 10}%` : "0",
                  background: d.diff > 0 ? COLORS.A : COLORS.B,
                  opacity: 0.8,
                }}
              />
            </div>
            <span className="text-xs font-bold w-8 text-right"
              style={{ color: d.diff > 0 ? COLORS.A : d.diff < 0 ? COLORS.B : "rgba(255,255,255,0.4)" }}>
              {d.diff > 0 ? `+${d.diff}` : d.diff}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
