import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const COLORS = { A: "#a78bfa", B: "#4ade80" };

const DARK_CARD: React.CSSProperties = {
  background: "linear-gradient(145deg, rgba(12,12,24,0.97) 0%, rgba(18,16,36,0.97) 100%)",
  boxShadow: "0 0 0 1px rgba(139,92,246,0.12), 0 24px 64px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)",
  borderRadius: 24,
  overflow: "hidden",
};

const CompareTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(8,8,18,0.96)", backdropFilter: "blur(20px)", borderRadius: 12, border: "1px solid rgba(139,92,246,0.3)", boxShadow: "0 16px 40px rgba(0,0,0,0.55)", padding: "10px 14px" }}>
      <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
        {payload[0]?.payload?.trait}
      </p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.stroke, fontSize: 13, fontWeight: 700 }}>
          {p.name}: <span>{p.value}</span>
        </p>
      ))}
    </div>
  );
};

interface Props {
  data: Array<{ trait: string; A: number; B: number }>;
  nameA: string;
  nameB: string;
  title: string;
}

export default function CompareRadarChart({ data, nameA, nameB, title }: Props) {
  return (
    <div style={DARK_CARD} className="p-5">
      <h2 className="text-sm font-bold mb-4" style={{ color: "rgba(255,255,255,0.88)" }}>{title}</h2>
      <div className="flex gap-5 mb-4">
        {[{ name: nameA, color: COLORS.A }, { name: nameB, color: COLORS.B }].map(({ name, color }) => (
          <div key={name} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: color }} />
            <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>{name}</span>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={340}>
        <RadarChart cx="50%" cy="50%" outerRadius="72%" data={data}>
          <PolarGrid stroke="rgba(139,92,246,0.12)" strokeDasharray="3 3" />
          <PolarAngleAxis dataKey="trait" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.55)", fontWeight: 600 }} />
          <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
          <Radar name={nameA} dataKey="A" stroke={COLORS.A} fill={COLORS.A} fillOpacity={0.15} strokeWidth={2.5} />
          <Radar name={nameB} dataKey="B" stroke={COLORS.B} fill={COLORS.B} fillOpacity={0.12} strokeWidth={2.5} />
          <Tooltip content={<CompareTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
