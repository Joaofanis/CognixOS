import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, Zap } from "lucide-react";

const DARK_CARD: React.CSSProperties = {
  background: "linear-gradient(145deg, rgba(12,12,24,0.97) 0%, rgba(18,16,36,0.97) 100%)",
  boxShadow: "0 0 0 1px rgba(139,92,246,0.12), 0 24px 64px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)",
  borderRadius: 24,
  overflow: "hidden",
};

function scoreColor(v: number): string {
  if (v >= 8) return "#a78bfa";
  if (v >= 6) return "#4ade80";
  if (v >= 4) return "#38bdf8";
  return "#64748b";
}

export default function CompareSkillSearch() {
  const [search, setSearch] = useState("");

  const { data: allAnalysis } = useQuery({
    queryKey: ["all-brain-analysis-skills"],
    queryFn: async () => {
      const { data: analyses } = await supabase
        .from("brain_analysis")
        .select("brain_id, skills");
      const { data: brains } = await supabase
        .from("brains")
        .select("id, name, type");
      
      if (!analyses || !brains) return [];

      const brainMap = new Map(brains.map((b) => [b.id, b]));
      
      return analyses
        .filter((a) => a.skills && typeof a.skills === "object")
        .map((a) => ({
          brainId: a.brain_id,
          brainName: brainMap.get(a.brain_id)?.name || "Desconhecido",
          brainType: brainMap.get(a.brain_id)?.type || "person_clone",
          skills: a.skills as Record<string, number>,
        }));
    },
  });

  const results = useMemo(() => {
    if (!search.trim() || !allAnalysis) return [];
    const q = search.toLowerCase();
    
    const matches: Array<{ brainName: string; brainType: string; skill: string; score: number }> = [];
    
    for (const brain of allAnalysis) {
      for (const [skill, score] of Object.entries(brain.skills)) {
        if (skill.toLowerCase().includes(q)) {
          matches.push({
            brainName: brain.brainName,
            brainType: brain.brainType,
            skill,
            score: Number(score) || 0,
          });
        }
      }
    }
    
    return matches.sort((a, b) => b.score - a.score);
  }, [search, allAnalysis]);

  return (
    <div style={DARK_CARD} className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Search className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.88)" }}>
          Buscar Habilidade
        </h2>
        <span className="text-[10px] ml-1" style={{ color: "rgba(255,255,255,0.4)" }}>
          Ex: "vendas", "persuasão", "negociação"
        </span>
      </div>
      <Input
        placeholder="Digite uma habilidade para buscar entre todos os cérebros..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="rounded-2xl bg-background/30 border-border/40 mb-3"
      />
      {results.length > 0 && (
        <div className="space-y-2">
          {results.slice(0, 10).map((r, i) => (
            <div key={`${r.brainName}-${r.skill}-${i}`} className="flex items-center gap-3">
              <Zap className="h-3 w-3 shrink-0" style={{ color: scoreColor(r.score) }} />
              <span className="text-xs font-bold truncate" style={{ color: "rgba(255,255,255,0.8)", minWidth: 80 }}>
                {r.brainName}
              </span>
              <span className="text-xs flex-1 truncate" style={{ color: "rgba(255,255,255,0.5)" }}>
                {r.skill}
              </span>
              <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                <div className="h-full rounded-full" style={{ width: `${r.score * 10}%`, background: scoreColor(r.score), opacity: 0.85 }} />
              </div>
              <span className="text-xs font-bold w-5 text-right" style={{ color: scoreColor(r.score) }}>
                {r.score}
              </span>
            </div>
          ))}
        </div>
      )}
      {search.trim() && results.length === 0 && (
        <p className="text-xs text-center py-3" style={{ color: "rgba(255,255,255,0.35)" }}>
          Nenhuma habilidade encontrada para "{search}"
        </p>
      )}
    </div>
  );
}
