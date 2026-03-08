import { Trophy } from "lucide-react";
import { useMemo } from "react";

const DARK_CARD: React.CSSProperties = {
  background: "linear-gradient(145deg, rgba(12,12,24,0.97) 0%, rgba(18,16,36,0.97) 100%)",
  boxShadow: "0 0 0 1px rgba(139,92,246,0.12), 0 24px 64px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)",
  borderRadius: 24,
  overflow: "hidden",
};

interface Props {
  nameA: string;
  nameB: string;
  traitsA: Record<string, number>;
  traitsB: Record<string, number>;
  skillsA: Record<string, number>;
  skillsB: Record<string, number>;
}

export default function CompareVerdict({ nameA, nameB, traitsA, traitsB, skillsA, skillsB }: Props) {
  const verdict = useMemo(() => {
    const avgA = Object.values(skillsA);
    const avgB = Object.values(skillsB);
    const skillAvgA = avgA.length ? avgA.reduce((a, b) => a + b, 0) / avgA.length : 0;
    const skillAvgB = avgB.length ? avgB.reduce((a, b) => a + b, 0) / avgB.length : 0;

    const topSkillsA = Object.entries(skillsA).sort(([, a], [, b]) => b - a).slice(0, 3).map(([k]) => k);
    const topSkillsB = Object.entries(skillsB).sort(([, a], [, b]) => b - a).slice(0, 3).map(([k]) => k);

    const traitAvgA = Object.values(traitsA);
    const traitAvgB = Object.values(traitsB);
    const tAvgA = traitAvgA.length ? traitAvgA.reduce((a, b) => a + b, 0) / traitAvgA.length : 0;
    const tAvgB = traitAvgB.length ? traitAvgB.reduce((a, b) => a + b, 0) / traitAvgB.length : 0;

    const lines: string[] = [];

    if (topSkillsA.length > 0) {
      lines.push(`🟣 ${nameA} se destaca em: ${topSkillsA.join(", ")} (média ${skillAvgA.toFixed(1)}/10)`);
    }
    if (topSkillsB.length > 0) {
      lines.push(`🟢 ${nameB} se destaca em: ${topSkillsB.join(", ")} (média ${skillAvgB.toFixed(1)}/10)`);
    }

    if (skillAvgA > skillAvgB + 0.5) {
      lines.push(`⚡ ${nameA} tem maior domínio técnico geral.`);
    } else if (skillAvgB > skillAvgA + 0.5) {
      lines.push(`⚡ ${nameB} tem maior domínio técnico geral.`);
    } else {
      lines.push(`⚡ Ambos têm nível técnico similar.`);
    }

    if (Math.abs(tAvgA - tAvgB) > 1) {
      const stronger = tAvgA > tAvgB ? nameA : nameB;
      lines.push(`🧠 ${stronger} apresenta traços/áreas mais pronunciados.`);
    }

    return lines;
  }, [nameA, nameB, traitsA, traitsB, skillsA, skillsB]);

  if (verdict.length === 0) return null;

  return (
    <div style={DARK_CARD} className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-4 w-4 text-amber-400" />
        <h2 className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.88)" }}>Veredito</h2>
      </div>
      <div className="space-y-2">
        {verdict.map((line, i) => (
          <p key={i} className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>{line}</p>
        ))}
      </div>
    </div>
  );
}
