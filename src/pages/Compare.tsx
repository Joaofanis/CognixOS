import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, GitCompareArrows, Brain as BrainIcon, Search, Zap, Trophy } from "lucide-react";
import CompareRadarChart from "@/components/compare/CompareRadarChart";
import CompareSkillsRadar from "@/components/compare/CompareSkillsRadar";
import CompareDiffBars from "@/components/compare/CompareDiffBars";
import CompareVerdict from "@/components/compare/CompareVerdict";
import CompareSkillSearch from "@/components/compare/CompareSkillSearch";

const COLORS = { A: "#a78bfa", B: "#4ade80" };

export default function Compare() {
  const navigate = useNavigate();
  const [brainA, setBrainA] = useState<string>("");
  const [brainB, setBrainB] = useState<string>("");

  // Fetch ALL brains (not just person_clone)
  const { data: allBrains } = useQuery({
    queryKey: ["all-brains-compare"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brains")
        .select("id, name, type")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: analysisA } = useQuery({
    queryKey: ["brain-analysis", brainA],
    queryFn: async () => {
      const { data } = await supabase
        .from("brain_analysis")
        .select("*")
        .eq("brain_id", brainA)
        .single();
      return data;
    },
    enabled: !!brainA,
  });

  const { data: analysisB } = useQuery({
    queryKey: ["brain-analysis", brainB],
    queryFn: async () => {
      const { data } = await supabase
        .from("brain_analysis")
        .select("*")
        .eq("brain_id", brainB)
        .single();
      return data;
    },
    enabled: !!brainB,
  });

  const nameA = allBrains?.find((b) => b.id === brainA)?.name || "Cérebro A";
  const nameB = allBrains?.find((b) => b.id === brainB)?.name || "Cérebro B";

  // Personality/knowledge traits
  const traitsA = (analysisA?.personality_traits || analysisA?.knowledge_areas || {}) as Record<string, number>;
  const traitsB = (analysisB?.personality_traits || analysisB?.knowledge_areas || {}) as Record<string, number>;
  const allTraits = new Set([...Object.keys(traitsA), ...Object.keys(traitsB)]);
  const radarData = Array.from(allTraits).map((trait) => ({
    trait: trait.charAt(0).toUpperCase() + trait.slice(1),
    A: traitsA[trait] || 0,
    B: traitsB[trait] || 0,
  }));

  // Skills
  const skillsA = ((analysisA as any)?.skills || {}) as Record<string, number>;
  const skillsB = ((analysisB as any)?.skills || {}) as Record<string, number>;
  const allSkills = new Set([...Object.keys(skillsA), ...Object.keys(skillsB)]);
  const skillsRadarData = Array.from(allSkills).map((skill) => ({
    trait: skill.charAt(0).toUpperCase() + skill.slice(1),
    A: skillsA[skill] || 0,
    B: skillsB[skill] || 0,
  }));

  // Diffs
  const traitDiffs = radarData
    .map((d) => ({ trait: d.trait, diff: d.A - d.B }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  const skillDiffs = skillsRadarData
    .map((d) => ({ trait: d.trait, diff: d.A - d.B }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  const hasBothSelected = brainA && brainB;
  const hasData = radarData.length > 0 || skillsRadarData.length > 0;

  return (
    <div className="min-h-screen bg-mesh bg-background">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-primary/8 rounded-full blur-3xl" />
        <div className="absolute -top-20 right-20 w-60 h-60 bg-accent/6 rounded-full blur-3xl" />
      </div>

      <header className="sticky top-0 z-20 glass border-b border-border/50">
        <div className="container flex h-16 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-2xl h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <GitCompareArrows className="h-5 w-5 text-primary" />
            <h1 className="font-extrabold text-lg text-gradient">Comparar Cérebros</h1>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-6 max-w-5xl relative">
        {/* Brain selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { val: brainA, set: setBrainA, label: "Cérebro A", color: COLORS.A },
            { val: brainB, set: setBrainB, label: "Cérebro B", color: COLORS.B },
          ].map(({ val, set, label, color }) => (
            <div key={label} className="space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-xs font-bold" style={{ color }}>{label}</span>
              </div>
              <Select value={val} onValueChange={set}>
                <SelectTrigger className="rounded-2xl border-border/60 bg-card/80 h-11">
                  <SelectValue placeholder={`Selecionar ${label}`} />
                </SelectTrigger>
                <SelectContent>
                  {allBrains?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({b.type === "person_clone" ? "Clone" : b.type === "knowledge_base" ? "Conhecimento" : b.type === "philosophy" ? "Filosofia" : "Guia"})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        {/* Skill search across all brains */}
        <CompareSkillSearch />

        {(!allBrains || allBrains.length < 2) && (
          <div className="text-center py-16 space-y-3">
            <div className="h-16 w-16 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto">
              <BrainIcon className="h-8 w-8 text-primary/40" />
            </div>
            <p className="font-semibold text-foreground">Você precisa de pelo menos 2 cérebros</p>
            <p className="text-sm text-muted-foreground">Crie mais cérebros para comparar.</p>
          </div>
        )}

        {hasBothSelected && hasData && (
          <div className="space-y-6">
            {/* Traits Radar */}
            {radarData.length > 0 && (
              <CompareRadarChart
                data={radarData}
                nameA={nameA}
                nameB={nameB}
                title="Comparação — Traços / Áreas"
              />
            )}

            {/* Traits Diffs */}
            {traitDiffs.length > 0 && (
              <CompareDiffBars diffs={traitDiffs} nameA={nameA} nameB={nameB} title="MAIORES DIFERENÇAS — TRAÇOS" />
            )}

            {/* Skills Radar */}
            {skillsRadarData.length > 0 && (
              <CompareSkillsRadar
                data={skillsRadarData}
                nameA={nameA}
                nameB={nameB}
              />
            )}

            {/* Skills Diffs */}
            {skillDiffs.length > 0 && (
              <CompareDiffBars diffs={skillDiffs} nameA={nameA} nameB={nameB} title="MAIORES DIFERENÇAS — HABILIDADES" />
            )}

            {/* Verdict */}
            <CompareVerdict
              nameA={nameA}
              nameB={nameB}
              traitsA={traitsA}
              traitsB={traitsB}
              skillsA={skillsA}
              skillsB={skillsB}
            />
          </div>
        )}
      </main>
    </div>
  );
}
