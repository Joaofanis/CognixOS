import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  BarChart3,
  Brain as BrainIcon,
  Sparkles,
  Zap,
  MessageSquareText,
} from "lucide-react";
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
  RadialBarChart,
  RadialBar,
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

const DARK_CARD_STYLE: React.CSSProperties = {
  background:
    "linear-gradient(145deg, rgba(12,12,24,0.97) 0%, rgba(18,16,36,0.97) 100%)",
  boxShadow:
    "0 0 0 1px rgba(139,92,246,0.12), 0 24px 64px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)",
};

const DARK_CARD_TITLE_STYLE: React.CSSProperties = {
  color: "rgba(255,255,255,0.88)",
};

function scoreColor(v: number): string {
  if (v >= 8) return "#a78bfa";
  if (v >= 6) return "#4ade80";
  if (v >= 4) return "#38bdf8";
  return "#64748b";
}

// ─── Tooltips ───────────────────────────────────────────

const RadarTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const val = payload[0].value as number;
  const col = scoreColor(val);
  return (
    <div
      style={{
        background: "rgba(8,8,18,0.96)",
        backdropFilter: "blur(20px)",
        borderRadius: 12,
        border: `1px solid ${col}55`,
        boxShadow: `0 0 28px ${col}28, 0 16px 40px rgba(0,0,0,0.55)`,
        padding: "10px 15px",
      }}
    >
      <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 600, marginBottom: 3 }}>
        {payload[0].payload.trait}
      </p>
      <p style={{ color: col, fontSize: 18, fontWeight: 800 }}>
        {val}<span style={{ fontSize: 11, opacity: 0.6 }}> / 10</span>
      </p>
    </div>
  );
};

const SkillsTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const val = payload[0].value as number;
  const name = payload[0].payload.name;
  const col = scoreColor(val / 10);
  return (
    <div
      style={{
        background: "rgba(8,8,18,0.96)",
        backdropFilter: "blur(20px)",
        borderRadius: 12,
        border: `1px solid ${col}55`,
        boxShadow: `0 0 28px ${col}28, 0 16px 40px rgba(0,0,0,0.55)`,
        padding: "10px 15px",
      }}
    >
      <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 600, marginBottom: 3 }}>
        {name}
      </p>
      <p style={{ color: col, fontSize: 18, fontWeight: 800 }}>
        {Math.round(val / 10)}<span style={{ fontSize: 11, opacity: 0.6 }}> / 10</span>
      </p>
    </div>
  );
};

const BarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "rgba(8,8,18,0.96)",
        backdropFilter: "blur(20px)",
        borderRadius: 12,
        border: "1px solid rgba(100,140,255,0.28)",
        boxShadow: "0 16px 40px rgba(0,0,0,0.55)",
        padding: "10px 14px",
        maxWidth: 220,
      }}
    >
      <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 600, marginBottom: 3 }}>
        {label}
      </p>
      <p style={{ color: "#F5BE40", fontSize: 13, fontWeight: 700 }}>
        {payload[0].value} menções
      </p>
    </div>
  );
};

const RADAR_GLOW = "rg-glow";
const RADAR_FILL = "rg-fill";
const BAR_GRAD = "bg-grad";

export default function BrainAnalysis({ brainId, brainType = "person_clone" }: Props) {
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
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("analyze-brain", {
        body: { brainId, brainType },
        headers: { Authorization: `Bearer ${session?.access_token}` },
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

  // ── Data prep ──
  const radarSource =
    brainType === "person_clone"
      ? (analysis?.personality_traits as Record<string, number> | null)
      : ((analysis?.knowledge_areas || analysis?.personality_traits) as Record<string, number> | null);

  const themes = analysis?.frequent_themes as Array<{ name: string; count: number }> | null;
  const skillsRaw = (analysis as any)?.skills as Record<string, number> | null;
  const skillsEvaluation = (analysis as any)?.skills_evaluation as string | null;

  const radarData = radarSource
    ? Object.entries(radarSource).map(([key, value]) => ({
        trait: key.charAt(0).toUpperCase() + key.slice(1),
        value: Number(value) || 0,
        fullMark: 10,
      }))
    : [];
  const sortedRadar = [...radarData].sort((a, b) => b.value - a.value);

  const skillsData = skillsRaw
    ? Object.entries(skillsRaw)
        .slice(0, 12)
        .map(([key, value]) => ({
          name: key.charAt(0).toUpperCase() + key.slice(1),
          value: Math.round((Number(value) || 0) * 10),
          rawValue: Number(value) || 0,
          fill: scoreColor(Number(value) || 0),
        }))
        .sort((a, b) => b.value - a.value)
    : [];

  const sortedThemes = themes ? [...themes].sort((a, b) => b.count - a.count) : [];
  const maxCount = sortedThemes[0]?.count || 1;

  return (
    <div className="container py-6 space-y-6 max-w-5xl">
      {/* Header */}
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
          {generating ? <Loader2 className="animate-spin h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
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
        <div className="space-y-6">
          {/* Row 1: Radar + Skills */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* ── Radar Chart ── */}
            <Card className="overflow-hidden border-0" style={DARK_CARD_STYLE}>
              <CardHeader className="pb-0 pt-5 px-5">
                <CardTitle className="text-sm font-bold flex items-center gap-2" style={DARK_CARD_TITLE_STYLE}>
                  <BrainIcon className="h-4 w-4 text-violet-400" />
                  {labels.radarTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-2 pb-4">
                {radarData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <RadarChart cx="50%" cy="50%" outerRadius="72%" data={radarData}>
                        <defs>
                          <filter id={RADAR_GLOW} x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="4" result="blur" />
                            <feMerge>
                              <feMergeNode in="blur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                          <radialGradient id={RADAR_FILL} cx="50%" cy="50%" r="55%" fx="50%" fy="50%">
                            <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.6} />
                            <stop offset="45%" stopColor="#6366f1" stopOpacity={0.28} />
                            <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.05} />
                          </radialGradient>
                        </defs>
                        <PolarGrid stroke="rgba(139,92,246,0.12)" strokeDasharray="3 3" />
                        <PolarAngleAxis
                          dataKey="trait"
                          tick={({ x, y, payload }) => {
                            const item = radarData.find((d) => d.trait === payload.value);
                            const col = scoreColor(item?.value ?? 5);
                            return (
                              <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
                                style={{ fontSize: 11.5, fontWeight: 700, fill: col }}>
                                {payload.value}
                              </text>
                            );
                          }}
                        />
                        <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                        <Radar
                          name={labels.radarTitle}
                          dataKey="value"
                          stroke="#a78bfa"
                          strokeWidth={2.5}
                          fill={`url(#${RADAR_FILL})`}
                          fillOpacity={1}
                          filter={`url(#${RADAR_GLOW})`}
                          dot={(props: any) => {
                            const col = scoreColor(props.payload?.value ?? 5);
                            return (
                              <circle key={`dot-${props.index}`} cx={props.cx} cy={props.cy}
                                r={5} fill={col} stroke="rgba(0,0,0,0.6)" strokeWidth={1.5} />
                            );
                          }}
                          activeDot={{ fill: "#fff", r: 7, strokeWidth: 2.5, stroke: "#a78bfa" }}
                        />
                        <Tooltip content={<RadarTooltip />} />
                      </RadarChart>
                    </ResponsiveContainer>
                    <div className="mt-1 px-3 flex flex-wrap gap-1.5 justify-center">
                      {sortedRadar.map((d) => {
                        const col = scoreColor(d.value);
                        return (
                          <span key={d.trait}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
                            style={{ background: `${col}18`, color: col, border: `1px solid ${col}45` }}>
                            {d.trait}
                            <span style={{ display: "inline-block", width: Math.max(8, (d.value / 10) * 24), height: 3, borderRadius: 2, background: col, opacity: 0.75, verticalAlign: "middle" }} />
                            <span style={{ opacity: 0.9 }}>{d.value}</span>
                          </span>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-center py-8 italic" style={{ color: "rgba(255,255,255,0.35)" }}>
                    Dados indisponíveis
                  </p>
                )}
              </CardContent>
            </Card>

            {/* ── Skills Chart (RadialBarChart) ── */}
            <Card className="overflow-hidden border-0" style={DARK_CARD_STYLE}>
              <CardHeader className="pb-0 pt-5 px-5">
                <CardTitle className="text-sm font-bold flex items-center gap-2" style={DARK_CARD_TITLE_STYLE}>
                  <Zap className="h-4 w-4 text-yellow-400" />
                  Habilidades Específicas
                  <span className="text-[10px] font-normal ml-1 px-1.5 py-0.5 rounded-full"
                    style={{ background: "rgba(250,204,21,0.12)", color: "#facc15", border: "1px solid rgba(250,204,21,0.3)" }}>
                    IA avaliou
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2 px-3 pb-4">
                {skillsData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={260}>
                      <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="90%"
                        data={skillsData} startAngle={90} endAngle={-270}>
                        <RadialBar dataKey="value" cornerRadius={6}
                          background={{ fill: "rgba(255,255,255,0.04)", radius: 6 }} label={false}>
                          {skillsData.map((entry, i) => (
                            <Cell key={`skill-${i}`} fill={entry.fill} fillOpacity={0.85} />
                          ))}
                        </RadialBar>
                        <Tooltip content={<SkillsTooltip />} />
                      </RadialBarChart>
                    </ResponsiveContainer>
                    <div className="mt-1 space-y-1.5 px-1">
                      {skillsData.map((s) => (
                        <div key={s.name} className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.fill }} />
                          <span className="text-xs font-semibold flex-1" style={{ color: "rgba(255,255,255,0.75)" }}>
                            {s.name}
                          </span>
                          <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${s.value}%`, background: s.fill, opacity: 0.85 }} />
                          </div>
                          <span className="text-[11px] font-bold w-5 text-right" style={{ color: s.fill }}>
                            {s.rawValue}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Zap className="h-8 w-8 opacity-20" style={{ color: "#facc15" }} />
                    <p className="text-sm italic text-center" style={{ color: "rgba(255,255,255,0.35)" }}>
                      Regere a análise para ver as habilidades avaliadas pela IA
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Skills Evaluation Text */}
          {skillsEvaluation && (
            <Card className="overflow-hidden border-0" style={DARK_CARD_STYLE}>
              <CardHeader className="pb-2 pt-5 px-5">
                <CardTitle className="text-sm font-bold flex items-center gap-2" style={DARK_CARD_TITLE_STYLE}>
                  <MessageSquareText className="h-4 w-4 text-emerald-400" />
                  Avaliação da IA sobre Habilidades
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
                  {skillsEvaluation}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Row 2: Themes Bar */}
          <Card className="overflow-hidden border-0" style={DARK_CARD_STYLE}>
            <CardHeader className="pb-2 pt-5 px-5">
              <CardTitle className="text-sm font-bold flex items-center gap-2" style={DARK_CARD_TITLE_STYLE}>
                <BarChart3 className="h-4 w-4 text-sky-400" />
                Temas Frequentes
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-4">
              {sortedThemes.length > 0 ? (
                <ResponsiveContainer width="100%"
                  height={Math.max(220, Math.min(sortedThemes.length * 28 + 40, 420))}>
                  <BarChart data={sortedThemes} layout="vertical"
                    margin={{ left: 8, right: 52, top: 4, bottom: 4 }} barCategoryGap="22%">
                    <defs>
                      <linearGradient id={BAR_GRAD} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                        <stop offset="50%" stopColor="#38bdf8" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#4ade80" stopOpacity={0.9} />
                      </linearGradient>
                    </defs>
                    <XAxis type="number" hide domain={[0, "dataMax"]} />
                    <YAxis dataKey="name" type="category" width={160}
                      tick={{ fontSize: 12, fill: "rgba(255,255,255,0.65)", fontWeight: 500 }}
                      axisLine={false} tickLine={false}
                      tickFormatter={(v: string) => v.length > 27 ? `${v.substring(0, 24)}…` : v} />
                    <Tooltip cursor={{ fill: "rgba(99,102,241,0.07)", rx: 6 }} content={<BarTooltip />} />
                    <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={18}
                      label={{ position: "right", fontSize: 11, fontWeight: 700, fill: "rgba(255,255,255,0.45)", formatter: (v: number) => v }}>
                      {sortedThemes.map((entry, i) => (
                        <Cell key={`t-${i}`} fill={`url(#${BAR_GRAD})`}
                          opacity={0.45 + (entry.count / maxCount) * 0.55} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm italic text-center py-8" style={{ color: "rgba(255,255,255,0.3)" }}>
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
