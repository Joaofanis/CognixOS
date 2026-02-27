import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BarChart3, Brain as BrainIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { BrainType } from "@/lib/brain-types";
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
} from "recharts";

interface Props {
  brainId: string;
  brainType?: BrainType;
}

const ANALYSIS_LABELS: Record<string, { title: string; radarTitle: string }> = {
  person_clone: {
    title: "Análise de Personalidade",
    radarTitle: "Traços de Personalidade",
  },
  knowledge_base: {
    title: "Análise de Conhecimento",
    radarTitle: "Áreas de Conhecimento",
  },
  philosophy: {
    title: "Análise Filosófica",
    radarTitle: "Princípios Filosóficos",
  },
  practical_guide: {
    title: "Análise de Competências",
    radarTitle: "Competências Práticas",
  },
};

// Colour palette per score intensity
function traitColor(value: number): string {
  if (value >= 8) return "#a78bfa"; // violet-400 — top tier
  if (value >= 6) return "#4ade80"; // green-400 — strong
  if (value >= 4) return "#38bdf8"; // sky-400 — mid
  return "#94a3b8"; // slate-400 — low
}

// Custom tooltip for polar chart
const CustomRadarTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const val = payload[0].value as number;
    return (
      <div
        style={{
          background: "rgba(10, 10, 20, 0.95)",
          backdropFilter: "blur(20px)",
          borderRadius: 14,
          border: `1px solid ${traitColor(val)}55`,
          boxShadow: `0 0 30px ${traitColor(val)}30, 0 20px 40px rgba(0,0,0,0.5)`,
          padding: "10px 16px",
        }}
      >
        <p
          style={{
            color: "rgba(255,255,255,0.85)",
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          {payload[0].payload.trait}
        </p>
        <p
          style={{
            color: traitColor(val),
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: -0.5,
          }}
        >
          {val}
          <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.65 }}>
            {" "}
            / 10
          </span>
        </p>
      </div>
    );
  }
  return null;
};

// Custom tooltip for bar chart
const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: "rgba(10, 10, 20, 0.95)",
          backdropFilter: "blur(20px)",
          borderRadius: 14,
          border: "1px solid rgba(100, 140, 255, 0.3)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
          padding: "10px 14px",
          maxWidth: 220,
        }}
      >
        <p
          style={{
            color: "rgba(255,255,255,0.9)",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 3,
          }}
        >
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

const BAR_GRADIENT_ID = "barGradientV2";
const RADAR_GLOW_ID = "radarGlow";
const RADAR_FILL_ID = "radarFillV2";

export default function BrainAnalysis({
  brainId,
  brainType = "person_clone",
}: Props) {
  const [generating, setGenerating] = useState(false);
  const labels = ANALYSIS_LABELS[brainType] || ANALYSIS_LABELS.person_clone;

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
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("analyze-brain", {
        body: { brainId, brainType },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) {
        const msg =
          typeof data === "object" && data?.error ? data.error : error.message;
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

  const radarSource =
    brainType === "person_clone"
      ? (analysis?.personality_traits as Record<string, number> | null)
      : ((analysis?.knowledge_areas || analysis?.personality_traits) as Record<
          string,
          number
        > | null);

  const themes = analysis?.frequent_themes as Array<{
    name: string;
    count: number;
  }> | null;

  const radarData = radarSource
    ? Object.entries(radarSource).map(([key, value]) => ({
        trait: key.charAt(0).toUpperCase() + key.slice(1),
        value: Number(value) || 0,
        fullMark: 10,
      }))
    : [];

  // Sort by value descending so highest traits appear first in pills
  const sortedRadar = [...radarData].sort((a, b) => b.value - a.value);
  const sortedThemes = themes
    ? [...themes].sort((a, b) => b.count - a.count)
    : [];
  const maxCount = sortedThemes[0]?.count || 1;

  return (
    <div className="container py-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg text-gradient">{labels.title}</h3>
          {analysis && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Atualizado em{" "}
              {new Date(analysis.updated_at).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
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
            <p className="font-semibold text-foreground">
              Nenhuma análise ainda
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Adicione textos à aba <strong>Fontes</strong> e clique em{" "}
              <strong>Gerar Análise</strong>.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* ── Radar Chart Card ── */}
          <Card
            className="overflow-hidden border-0"
            style={{
              background:
                "linear-gradient(145deg, rgba(15,15,30,0.97) 0%, rgba(20,18,40,0.97) 100%)",
              boxShadow:
                "0 0 0 1px rgba(139,92,246,0.15), 0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            <CardHeader className="pb-0 pt-5 px-5">
              <CardTitle
                className="text-sm font-bold flex items-center gap-2"
                style={{ color: "rgba(255,255,255,0.9)" }}
              >
                <BrainIcon className="h-4 w-4" style={{ color: "#a78bfa" }} />
                {labels.radarTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-2 pb-4">
              {radarData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={320}>
                    <RadarChart
                      cx="50%"
                      cy="50%"
                      outerRadius="72%"
                      data={radarData}
                    >
                      <defs>
                        {/* Glow filter for the stroke */}
                        <filter
                          id={RADAR_GLOW_ID}
                          x="-20%"
                          y="-20%"
                          width="140%"
                          height="140%"
                        >
                          <feGaussianBlur stdDeviation="4" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                        {/* Radial gradient fill */}
                        <radialGradient
                          id={RADAR_FILL_ID}
                          cx="50%"
                          cy="50%"
                          r="55%"
                          fx="50%"
                          fy="50%"
                        >
                          <stop
                            offset="0%"
                            stopColor="#a78bfa"
                            stopOpacity={0.6}
                          />
                          <stop
                            offset="45%"
                            stopColor="#6366f1"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="100%"
                            stopColor="#4f46e5"
                            stopOpacity={0.06}
                          />
                        </radialGradient>
                      </defs>
                      <PolarGrid
                        stroke="rgba(139,92,246,0.12)"
                        strokeDasharray="3 3"
                      />
                      <PolarAngleAxis
                        dataKey="trait"
                        tick={({ x, y, payload }) => {
                          // Find value for this trait to colour-code the label
                          const item = radarData.find(
                            (d) => d.trait === payload.value,
                          );
                          const val = item?.value ?? 5;
                          return (
                            <text
                              x={x}
                              y={y}
                              textAnchor="middle"
                              dominantBaseline="central"
                              style={{
                                fontSize: 11.5,
                                fontWeight: 700,
                                fill: traitColor(val),
                                letterSpacing: 0.2,
                              }}
                            >
                              {payload.value}
                            </text>
                          );
                        }}
                      />
                      <PolarRadiusAxis
                        angle={30}
                        domain={[0, 10]}
                        tick={false}
                        axisLine={false}
                      />
                      <Radar
                        name={labels.radarTitle}
                        dataKey="value"
                        stroke="#a78bfa"
                        strokeWidth={2.5}
                        fill={`url(#${RADAR_FILL_ID})`}
                        fillOpacity={1}
                        filter={`url(#${RADAR_GLOW_ID})`}
                        dot={(props: any) => {
                          const val = props.payload?.value ?? 5;
                          const color = traitColor(val);
                          return (
                            <circle
                              key={`dot-${props.index}`}
                              cx={props.cx}
                              cy={props.cy}
                              r={5}
                              fill={color}
                              stroke="rgba(0,0,0,0.6)"
                              strokeWidth={1.5}
                            />
                          );
                        }}
                        activeDot={{
                          fill: "#fff",
                          r: 7,
                          strokeWidth: 2.5,
                          stroke: "#a78bfa",
                        }}
                      />
                      <Tooltip content={<CustomRadarTooltip />} />
                    </RadarChart>
                  </ResponsiveContainer>

                  {/* Score pills — sorted by value */}
                  <div className="mt-1 px-3 flex flex-wrap gap-1.5 justify-center">
                    {sortedRadar.map((d) => {
                      const color = traitColor(d.value);
                      return (
                        <span
                          key={d.trait}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
                          style={{
                            background: `${color}18`,
                            color,
                            border: `1px solid ${color}45`,
                          }}
                        >
                          {d.trait}
                          {/* Mini bar */}
                          <span
                            style={{
                              display: "inline-block",
                              width: Math.max(10, (d.value / 10) * 26),
                              height: 3,
                              borderRadius: 2,
                              background: color,
                              opacity: 0.75,
                              verticalAlign: "middle",
                            }}
                          />
                          <span style={{ opacity: 0.9 }}>{d.value}</span>
                        </span>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8 italic">
                  Dados indisponíveis
                </p>
              )}
            </CardContent>
          </Card>

          {/* ── Bar Chart Card ── */}
          <Card className="glass border-primary/10 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <BarChart3 className="h-4 w-4 text-primary" />
                Temas Frequentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sortedThemes.length > 0 ? (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(
                    260,
                    Math.min(sortedThemes.length * 30 + 40, 460),
                  )}
                >
                  <BarChart
                    data={sortedThemes}
                    layout="vertical"
                    margin={{ left: 8, right: 48, top: 4, bottom: 4 }}
                    barCategoryGap="22%"
                  >
                    <defs>
                      <linearGradient
                        id={BAR_GRADIENT_ID}
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="0"
                      >
                        <stop
                          offset="0%"
                          stopColor="hsl(222 82% 52%)"
                          stopOpacity={1}
                        />
                        <stop
                          offset="55%"
                          stopColor="hsl(43 92% 50%)"
                          stopOpacity={0.95}
                        />
                        <stop
                          offset="100%"
                          stopColor="hsl(162 68% 38%)"
                          stopOpacity={0.9}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis type="number" hide domain={[0, "dataMax"]} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={155}
                      tick={{
                        fontSize: 12,
                        fill: "hsl(var(--foreground))",
                        fillOpacity: 0.7,
                        fontWeight: 500,
                      }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value: string) =>
                        value.length > 26
                          ? `${value.substring(0, 23)}...`
                          : value
                      }
                    />
                    <Tooltip
                      cursor={{ fill: "hsla(var(--primary), 0.06)", rx: 6 }}
                      content={<CustomBarTooltip />}
                    />
                    <Bar
                      dataKey="count"
                      radius={[0, 8, 8, 0]}
                      barSize={20}
                      label={{
                        position: "right",
                        fontSize: 11,
                        fontWeight: 700,
                        fill: "hsl(var(--muted-foreground))",
                        formatter: (v: number) => v,
                      }}
                    >
                      {sortedThemes.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={`url(#${BAR_GRADIENT_ID})`}
                          opacity={0.5 + (entry.count / maxCount) * 0.5}
                        />
                      ))}
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
