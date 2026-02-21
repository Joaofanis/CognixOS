import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, BarChart3, Brain as BrainIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  defs,
  linearGradient,
  stop,
} from "recharts";

interface Props {
  brainId: string;
}

// Custom tooltip for bar chart
const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: "rgba(15, 15, 25, 0.92)",
          backdropFilter: "blur(16px)",
          borderRadius: "14px",
          border: "1px solid rgba(139, 92, 246, 0.3)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
          padding: "12px 16px",
          maxWidth: 240,
        }}
      >
        <p style={{ color: "rgba(255,255,255,0.95)", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
          {label}
        </p>
        <p style={{ color: "#F5BE40", fontSize: 13, fontWeight: 700 }}>
          {payload[0].value} menções
        </p>
      </div>
    );
  }
  return null;
};

// Custom tooltip for radar
const CustomRadarTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: "rgba(15, 15, 25, 0.92)",
          backdropFilter: "blur(16px)",
          borderRadius: "14px",
          border: "1px solid rgba(139, 92, 246, 0.3)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
          padding: "10px 14px",
        }}
      >
        <p style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: 600 }}>
          {payload[0].payload.trait}
        </p>
        <p style={{ color: "#4D83F0", fontSize: 14, fontWeight: 700 }}>
          {payload[0].value} / 10
        </p>
      </div>
    );
  }
  return null;
};

// Gradient fill for bars — intensity based on rank
const BAR_GRADIENT_ID = "barGradient";

export default function BrainAnalysis({ brainId }: Props) {
  const [generating, setGenerating] = useState(false);

  const { data: analysis, refetch } = useQuery({
    queryKey: ["brain-analysis", brainId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brain_analysis")
        .select("*")
        .eq("brain_id", brainId)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  const generateAnalysis = async () => {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("analyze-brain", {
        body: { brainId },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });
      if (error) {
        const msg = typeof data === "object" && data?.error ? data.error : error.message;
        throw new Error(msg || "Erro ao gerar análise");
      }
      if (data?.error) throw new Error(data.error);
      refetch();
      toast.success("Análise gerada com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar análise");
    } finally {
      setGenerating(false);
    }
  };

  const traits = analysis?.personality_traits as Record<string, number> | null;
  const themes = analysis?.frequent_themes as Array<{ name: string; count: number }> | null;

  const radarData = traits
    ? Object.entries(traits).map(([key, value]) => ({
        trait: key.charAt(0).toUpperCase() + key.slice(1),
        value: Number(value) || 0,
        fullMark: 10,
      }))
    : [];

  // Sorted themes (should already be sorted from edge function)
  const sortedThemes = themes ? [...themes].sort((a, b) => b.count - a.count) : [];

  // Max count for relative bar coloring
  const maxCount = sortedThemes[0]?.count || 1;

  return (
    <div className="container py-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg text-gradient">Análise de Personalidade</h3>
          {analysis && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Atualizado em {new Date(analysis.updated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
          )}
        </div>
        <Button
          onClick={generateAnalysis}
          disabled={generating}
          variant="outline"
          size="sm"
          className="gap-2 rounded-2xl border-primary/30 hover:border-primary/60 hover:bg-primary/8 font-semibold"
        >
          {generating ? (
            <Loader2 className="animate-spin h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {analysis ? "Atualizar" : "Gerar"} Análise
        </Button>
      </div>

      {!analysis ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="h-16 w-16 rounded-3xl bg-primary/10 flex items-center justify-center">
            <BrainIcon className="h-8 w-8 text-primary/60" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Nenhuma análise ainda</p>
            <p className="text-sm text-muted-foreground mt-1">
              Adicione textos à aba <strong>Fontes</strong> e clique em <strong>Gerar Análise</strong>.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Radar Chart */}
          <Card className="glass border-primary/10 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BrainIcon className="h-4 w-4 text-primary" />
                Traços de Personalidade
              </CardTitle>
            </CardHeader>
            <CardContent>
              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={340}>
                  <RadarChart cx="50%" cy="50%" outerRadius="78%" data={radarData}>
                    <defs>
                      <radialGradient id="radarFill" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                        <stop offset="0%" stopColor="hsl(var(--jade))" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.08} />
                      </radialGradient>
                    </defs>
                    <PolarGrid stroke="hsla(var(--primary), 0.10)" />
                    <PolarAngleAxis
                      dataKey="trait"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontWeight: 600 }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 10]}
                      tick={false}
                      axisLine={false}
                    />
                    <Radar
                      name="Personalidade"
                      dataKey="value"
                      stroke="hsl(var(--jade))"
                      fill="url(#radarFill)"
                      fillOpacity={1}
                      strokeWidth={2.5}
                      dot={{ fill: "hsl(var(--jade))", r: 4, strokeWidth: 0 }}
                      activeDot={{ fill: "hsl(var(--accent))", r: 6, strokeWidth: 2, stroke: "white" }}
                    />
                    <Tooltip content={<CustomRadarTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8 italic">
                  Dados de personalidade indisponíveis
                </p>
              )}

              {/* Trait Score Pills */}
              {radarData.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 justify-center">
                  {radarData.map((d) => {
                    const isHigh = d.value >= 7;
                    return (
                      <span
                        key={d.trait}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                        style={{
                          background: isHigh
                            ? `hsla(var(--accent), 0.18)`
                            : `hsla(var(--jade), ${0.08 + (d.value / 10) * 0.14})`,
                          color: isHigh ? `hsl(var(--accent))` : `hsl(var(--jade))`,
                          border: isHigh
                            ? `1px solid hsla(var(--accent), 0.35)`
                            : `1px solid hsla(var(--jade), ${0.15 + (d.value / 10) * 0.2})`,
                        }}
                      >
                        {d.trait}
                        <span className="opacity-75 font-bold">{d.value}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bar Chart */}
          <Card className="glass border-primary/10 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Temas Frequentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sortedThemes.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(300, Math.min(sortedThemes.length * 32 + 40, 480))}>
                  <BarChart
                    data={sortedThemes}
                    layout="vertical"
                    margin={{ left: 8, right: 40, top: 4, bottom: 4 }}
                    barCategoryGap="22%"
                  >
                    <defs>
                      <linearGradient id={BAR_GRADIENT_ID} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                        <stop offset="60%" stopColor="hsl(var(--accent))" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="hsl(var(--jade))" stopOpacity={0.9} />
                      </linearGradient>
                    </defs>
                    <XAxis type="number" hide domain={[0, "dataMax"]} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={148}
                      tick={{
                        fontSize: 11,
                        fill: "hsl(var(--muted-foreground))",
                        fontWeight: 500,
                      }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value: string) =>
                        value.length > 24 ? `${value.substring(0, 21)}...` : value
                      }
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(139,92,246,0.06)", rx: 6 }}
                      content={<CustomBarTooltip />}
                    />
                    <Bar
                      dataKey="count"
                      radius={[0, 8, 8, 0]}
                      barSize={22}
                      label={{
                        position: "right",
                        fontSize: 11,
                        fontWeight: 700,
                        fill: "hsl(var(--muted-foreground))",
                        formatter: (v: number) => v,
                      }}
                    >
                      {sortedThemes.map((entry, index) => {
                        const intensity = 0.5 + (entry.count / maxCount) * 0.5;
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={`url(#${BAR_GRADIENT_ID})`}
                            opacity={intensity}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8 italic">
                  Sem dados suficientes para análise temática
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
