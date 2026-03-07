import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import {
  ArrowLeft,
  Brain,
  RefreshCw,
  Save,
  User,
  MessageSquare,
  Zap,
  BookOpen,
  Sparkles,
  Loader2,
  Edit3,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

interface UserAIProfile {
  id: string;
  user_id: string;
  response_length_pref: "short" | "medium" | "long" | "adaptive";
  formality_level: number;
  prefers_bullet_points: boolean;
  prefers_examples: boolean;
  traits: Record<string, number>;
  frequent_words: string[];
  topics_of_interest: string[];
  user_notes: string | null;
  ai_summary: string | null;
  message_count: number;
  avg_message_length: number;
  last_analyzed_at: string | null;
  updated_at: string;
}

const TRAIT_LABELS: Record<string, string> = {
  curioso: "Curioso",
  direto: "Direto",
  tecnico: "Técnico",
  criativo: "Criativo",
  emocional: "Emocional",
  sistematico: "Sistemático",
  informal: "Informal",
};

const LENGTH_LABELS = {
  short: "Curtas",
  medium: "Médias",
  long: "Longas",
  adaptive: "Adaptativas",
};

const CHART_COLORS = [
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#6366f1",
  "#14b8a6",
];

export default function UserProfileAI() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);

  const { data: profile, isLoading } = useQuery<UserAIProfile>({
    queryKey: ["user_ai_profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_ai_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data as UserAIProfile;
    },
  });

  useEffect(() => {
    if (profile?.user_notes) setNotes(profile.user_notes);
  }, [profile]);

  const saveNotesMutation = useMutation({
    mutationFn: async (newNotes: string) => {
      const { error } = await supabase
        .from("user_ai_profiles")
        .upsert(
          { user_id: user!.id, user_notes: newNotes },
          { onConflict: "user_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_ai_profile"] });
      setEditingNotes(false);
      toast.success("Notas salvas!");
    },
    onError: () => toast.error("Falha ao salvar notas"),
  });

  // Radar chart data from traits
  const radarData = Object.entries(profile?.traits || {}).map(
    ([key, value]) => ({
      subject: TRAIT_LABELS[key] || key,
      A: value,
      fullMark: 100,
    }),
  );

  // Topics bar data
  const topicsData = (profile?.topics_of_interest || [])
    .slice(0, 8)
    .map((topic, i) => ({
      name: topic,
      value: Math.max(20, 100 - i * 10),
    }));

  // Formality gauge (0-100)
  const formalityPct = profile?.formality_level ?? 50;
  const formalityLabel =
    formalityPct < 30
      ? "Muito informal"
      : formalityPct < 50
        ? "Informal"
        : formalityPct < 70
          ? "Neutro"
          : formalityPct < 85
            ? "Formal"
            : "Muito formal";

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasProfile = !!profile;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="flex h-12 items-center gap-2 px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-8 w-8 rounded-lg"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Brain className="h-4 w-4 text-primary" />
          <h1 className="font-bold text-sm">Meu Perfil IA</h1>
          {hasProfile && profile.last_analyzed_at && (
            <Badge variant="outline" className="ml-auto text-[10px]">
              Atualizado{" "}
              {new Date(profile.last_analyzed_at).toLocaleDateString("pt-BR")}
            </Badge>
          )}
        </div>
      </header>

      <ScrollArea className="h-[calc(100vh-3rem)]">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
          {/* No profile yet */}
          {!hasProfile && (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 animate-in fade-in duration-500">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center border border-primary/20">
                <User className="h-10 w-10 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold">Perfil ainda não criado</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                  O perfil é construído automaticamente enquanto você conversa
                  com seus clones. Comece a usar o chat para ver seus dados
                  aqui.
                </p>
              </div>
              <Button
                onClick={() => navigate("/chat")}
                className="gap-2 rounded-xl"
              >
                <MessageSquare className="h-4 w-4" />
                Ir para o Chat
              </Button>
            </div>
          )}

          {hasProfile && (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    icon: MessageSquare,
                    label: "Mensagens",
                    value: profile.message_count,
                  },
                  {
                    icon: Zap,
                    label: "Comprimento médio",
                    value: `${profile.avg_message_length} chars`,
                  },
                  {
                    icon: BookOpen,
                    label: "Tópicos",
                    value: profile.topics_of_interest?.length || 0,
                  },
                  {
                    icon: Sparkles,
                    label: "Preferência",
                    value:
                      LENGTH_LABELS[profile.response_length_pref] || "Média",
                  },
                ].map(({ icon: Icon, label, value }) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-border/50 bg-card/60 p-4 text-center"
                  >
                    <Icon className="h-4 w-4 text-primary mx-auto mb-1.5" />
                    <p className="text-xl font-bold">{value}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {label}
                    </p>
                  </div>
                ))}
              </div>

              {/* AI Summary */}
              {profile.ai_summary && (
                <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold text-primary">
                      Como a IA te vê
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed">
                    {profile.ai_summary}
                  </p>
                </div>
              )}

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Radar — Traços de personalidade */}
                {radarData.length > 0 && (
                  <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                    <p className="text-sm font-bold mb-3 flex items-center gap-2">
                      <Brain className="h-4 w-4 text-primary" />
                      Traços de Comunicação
                    </p>
                    <ResponsiveContainer width="100%" height={220}>
                      <RadarChart data={radarData}>
                        <PolarGrid
                          stroke="hsl(var(--border))"
                          strokeOpacity={0.5}
                        />
                        <PolarAngleAxis
                          dataKey="subject"
                          tick={{
                            fontSize: 11,
                            fill: "hsl(var(--muted-foreground))",
                          }}
                        />
                        <Radar
                          name="Perfil"
                          dataKey="A"
                          stroke="hsl(var(--primary))"
                          fill="hsl(var(--primary))"
                          fillOpacity={0.25}
                          strokeWidth={2}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Bar — Tópicos de interesse */}
                {topicsData.length > 0 && (
                  <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                    <p className="text-sm font-bold mb-3 flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-primary" />
                      Tópicos de Interesse
                    </p>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={topicsData} layout="vertical">
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{
                            fontSize: 11,
                            fill: "hsl(var(--muted-foreground))",
                          }}
                          width={90}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "12px",
                            fontSize: 12,
                          }}
                          formatter={(v: number) => [`${v}%`, "Relevância"]}
                        />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                          {topicsData.map((_, i) => (
                            <Cell
                              key={i}
                              fill={CHART_COLORS[i % CHART_COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Style preferences */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Formality gauge */}
                <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3">
                  <p className="text-sm font-bold flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-400" />
                    Nível de Formalidade
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Informal</span>
                      <span className="font-semibold text-foreground">
                        {formalityLabel}
                      </span>
                      <span>Formal</span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-violet-500 transition-all duration-700"
                        style={{ width: `${formalityPct}%` }}
                      />
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                      {formalityPct}/100
                    </p>
                  </div>

                  {/* Preferences chips */}
                  <div className="flex gap-2 flex-wrap pt-1">
                    {profile.prefers_bullet_points && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-primary/30 text-primary"
                      >
                        • Listas
                      </Badge>
                    )}
                    {profile.prefers_examples && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-emerald-500/30 text-emerald-400"
                      >
                        💡 Exemplos
                      </Badge>
                    )}
                    {profile.prefers_portuguese && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-blue-500/30 text-blue-400"
                      >
                        🇧🇷 Português
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px]">
                      Resposta {LENGTH_LABELS[profile.response_length_pref]}
                    </Badge>
                  </div>
                </div>

                {/* Frequent words */}
                <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                  <p className="text-sm font-bold mb-3 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-blue-400" />
                    Palavras Frequentes
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(profile.frequent_words || [])
                      .slice(0, 20)
                      .map((word, i) => (
                        <span
                          key={word}
                          className="inline-block px-2.5 py-1 rounded-full text-xs font-medium border"
                          style={{
                            fontSize: `${Math.max(10, 14 - i * 0.4)}px`,
                            opacity: Math.max(0.5, 1 - i * 0.03),
                            borderColor: `${CHART_COLORS[i % CHART_COLORS.length]}40`,
                            color: CHART_COLORS[i % CHART_COLORS.length],
                            background: `${CHART_COLORS[i % CHART_COLORS.length]}10`,
                          }}
                        >
                          {word}
                        </span>
                      ))}
                    {(profile.frequent_words || []).length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Nenhuma palavra identificada ainda
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* User notes */}
              <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold flex items-center gap-2">
                    <Edit3 className="h-4 w-4 text-foreground/70" />
                    Minhas Notas para a IA
                  </p>
                  {!editingNotes ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingNotes(true)}
                      className="h-7 px-2 text-xs gap-1 rounded-lg"
                    >
                      <Edit3 className="h-3 w-3" />
                      Editar
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingNotes(false);
                          setNotes(profile.user_notes || "");
                        }}
                        className="h-7 px-2 text-xs rounded-lg"
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => saveNotesMutation.mutate(notes)}
                        disabled={saveNotesMutation.isPending}
                        className="h-7 px-2 text-xs gap-1 rounded-lg"
                      >
                        {saveNotesMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Save className="h-3 w-3" />
                        )}
                        Salvar
                      </Button>
                    </div>
                  )}
                </div>
                {editingNotes ? (
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Escreva aqui como você prefere que a IA responda, suas preferências, contexto pessoal relevante, etc."
                    className="min-h-[120px] resize-none rounded-xl text-sm bg-background/60"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap min-h-[60px]">
                    {notes ||
                      "Nenhuma nota adicionada. Clique em 'Editar' para adicionar preferências manuais que a IA irá considerar em todas as respostas."}
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground/60">
                  💡 Estas notas são injetadas no sistema de prompts em todas as
                  conversas
                </p>
              </div>
            </>
          )}

          {/* Go to chat CTA */}
          <div className="pb-4">
            <button
              onClick={() => navigate("/chat")}
              className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Sparkles className="h-4 w-4 text-primary" />
                <div className="text-left">
                  <p className="text-sm font-semibold text-primary">
                    Chat Geral
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Continue conversando para enriquecer seu perfil
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-primary/60" />
            </button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
