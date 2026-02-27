import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, GitCompareArrows, Brain as BrainIcon } from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const DARK_CARD: React.CSSProperties = {
  background:
    "linear-gradient(145deg, rgba(12,12,24,0.97) 0%, rgba(18,16,36,0.97) 100%)",
  boxShadow:
    "0 0 0 1px rgba(139,92,246,0.12), 0 24px 64px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)",
  borderRadius: 24,
  overflow: "hidden",
};

const COLORS = { A: "#a78bfa", B: "#4ade80" };

const CompareTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "rgba(8,8,18,0.96)",
        backdropFilter: "blur(20px)",
        borderRadius: 12,
        border: "1px solid rgba(139,92,246,0.3)",
        boxShadow: "0 16px 40px rgba(0,0,0,0.55)",
        padding: "10px 14px",
      }}
    >
      <p
        style={{
          color: "rgba(255,255,255,0.8)",
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 4,
        }}
      >
        {payload[0]?.payload?.trait}
      </p>
      {payload.map((p: any) => (
        <p
          key={p.name}
          style={{ color: p.stroke, fontSize: 13, fontWeight: 700 }}
        >
          {p.name}: <span>{p.value}</span>
        </p>
      ))}
    </div>
  );
};

export default function Compare() {
  const navigate = useNavigate();
  const [brainA, setBrainA] = useState<string>("");
  const [brainB, setBrainB] = useState<string>("");

  const { data: personBrains } = useQuery({
    queryKey: ["person-brains"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brains")
        .select("id, name")
        .eq("type", "person_clone")
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

  const traitsA = (analysisA?.personality_traits || {}) as Record<
    string,
    number
  >;
  const traitsB = (analysisB?.personality_traits || {}) as Record<
    string,
    number
  >;
  const allTraits = new Set([...Object.keys(traitsA), ...Object.keys(traitsB)]);
  const radarData = Array.from(allTraits).map((trait) => ({
    trait: trait.charAt(0).toUpperCase() + trait.slice(1),
    A: traitsA[trait] || 0,
    B: traitsB[trait] || 0,
  }));

  const nameA = personBrains?.find((b) => b.id === brainA)?.name || "Cérebro A";
  const nameB = personBrains?.find((b) => b.id === brainB)?.name || "Cérebro B";

  // Diff stats
  const diffs = radarData
    .map((d) => ({ trait: d.trait, diff: d.A - d.B }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  return (
    <div className="min-h-screen bg-mesh bg-background">
      {/* Fixed ambient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-primary/8 rounded-full blur-3xl" />
        <div className="absolute -top-20 right-20 w-60 h-60 bg-accent/6 rounded-full blur-3xl" />
      </div>

      <header className="sticky top-0 z-20 glass border-b border-border/50">
        <div className="container flex h-16 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="rounded-2xl h-9 w-9"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <GitCompareArrows className="h-5 w-5 text-primary" />
            <h1 className="font-extrabold text-lg text-gradient">
              Comparar Cérebros
            </h1>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-6 max-w-4xl relative">
        {/* Brain selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              val: brainA,
              set: setBrainA,
              label: "Cérebro A",
              color: COLORS.A,
            },
            {
              val: brainB,
              set: setBrainB,
              label: "Cérebro B",
              color: COLORS.B,
            },
          ].map(({ val, set, label, color }) => (
            <div key={label} className="space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: color }}
                />
                <span className="text-xs font-bold" style={{ color }}>
                  {label}
                </span>
              </div>
              <Select value={val} onValueChange={set}>
                <SelectTrigger className="rounded-2xl border-border/60 bg-card/80 h-11">
                  <SelectValue placeholder={`Selecionar ${label}`} />
                </SelectTrigger>
                <SelectContent>
                  {personBrains?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        {/* Hint when no brains selected */}
        {(!personBrains || personBrains.length < 2) && (
          <div className="text-center py-16 space-y-3">
            <div className="h-16 w-16 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto">
              <BrainIcon className="h-8 w-8 text-primary/40" />
            </div>
            <p className="font-semibold text-foreground">
              Você precisa de pelo menos 2 clones
            </p>
            <p className="text-sm text-muted-foreground">
              Crie mais clones do tipo <strong>Pessoa</strong> para comparar
              personalidades.
            </p>
          </div>
        )}

        {/* Radar chart */}
        {brainA && brainB && radarData.length > 0 && (
          <div style={DARK_CARD} className="p-5">
            <h2
              className="text-sm font-bold mb-4"
              style={{ color: "rgba(255,255,255,0.88)" }}
            >
              Comparação — Traços de Personalidade
            </h2>

            {/* Legend */}
            <div className="flex gap-5 mb-4">
              {[
                { name: nameA, color: COLORS.A },
                { name: nameB, color: COLORS.B },
              ].map(({ name, color }) => (
                <div key={name} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ background: color }}
                  />
                  <span
                    className="text-xs font-semibold"
                    style={{ color: "rgba(255,255,255,0.7)" }}
                  >
                    {name}
                  </span>
                </div>
              ))}
            </div>

            <ResponsiveContainer width="100%" height={340}>
              <RadarChart cx="50%" cy="50%" outerRadius="72%" data={radarData}>
                <defs>
                  <filter
                    id="glow-a"
                    x="-20%"
                    y="-20%"
                    width="140%"
                    height="140%"
                  >
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <PolarGrid
                  stroke="rgba(139,92,246,0.12)"
                  strokeDasharray="3 3"
                />
                <PolarAngleAxis
                  dataKey="trait"
                  tick={{
                    fontSize: 11,
                    fill: "rgba(255,255,255,0.55)",
                    fontWeight: 600,
                  }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 10]}
                  tick={false}
                  axisLine={false}
                />
                <Radar
                  name={nameA}
                  dataKey="A"
                  stroke={COLORS.A}
                  fill={COLORS.A}
                  fillOpacity={0.15}
                  strokeWidth={2.5}
                />
                <Radar
                  name={nameB}
                  dataKey="B"
                  stroke={COLORS.B}
                  fill={COLORS.B}
                  fillOpacity={0.12}
                  strokeWidth={2.5}
                />
                <Tooltip content={<CompareTooltip />} />
              </RadarChart>
            </ResponsiveContainer>

            {/* Diff table */}
            {diffs.length > 0 && (
              <div className="mt-4 space-y-2">
                <p
                  className="text-xs font-bold mb-2"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
                  MAIORES DIFERENÇAS
                </p>
                {diffs.slice(0, 5).map((d) => (
                  <div key={d.trait} className="flex items-center gap-3">
                    <span
                      className="text-xs w-28 shrink-0"
                      style={{ color: "rgba(255,255,255,0.6)" }}
                    >
                      {d.trait}
                    </span>
                    <div
                      className="flex-1 h-1.5 rounded-full overflow-hidden"
                      style={{ background: "rgba(255,255,255,0.07)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.abs(d.diff) * 10}%`,
                          marginLeft:
                            d.diff < 0
                              ? `${(10 - Math.abs(d.diff)) * 10}%`
                              : "0",
                          background: d.diff > 0 ? COLORS.A : COLORS.B,
                          opacity: 0.8,
                        }}
                      />
                    </div>
                    <span
                      className="text-xs font-bold w-8 text-right"
                      style={{
                        color:
                          d.diff > 0
                            ? COLORS.A
                            : d.diff < 0
                              ? COLORS.B
                              : "rgba(255,255,255,0.4)",
                      }}
                    >
                      {d.diff > 0 ? `+${d.diff}` : d.diff}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
