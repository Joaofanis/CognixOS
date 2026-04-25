import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Fingerprint, Brain, Zap, MessageSquare, Activity, Waves, Network, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PsychometricRadarProps {
  brainId: string;
}

const COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4"];

export default function PsychometricRadar({ brainId }: PsychometricRadarProps) {
  const queryClient = useQueryClient();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [activeModel, setActiveModel] = useState<'ocean' | 'hexaco'>('ocean');

  const { data: analysis, isLoading, refetch } = useQuery({
    queryKey: ["brain_analysis", brainId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brain_analysis")
        .select("*")
        .eq("brain_id", brainId)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!brainId,
  });

  // Auto-upgrade legacy clones
  useEffect(() => {
    if (analysis && (!analysis.cognitive_dna || !analysis.communication_style || !analysis.voice_patterns) && !isUpgrading) {
      const upgradeClone = async () => {
        setIsUpgrading(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          // We assume 'person_clone' as default for auto-upgrades if type is unknown here
          await supabase.functions.invoke("analyze-brain", {
            body: { brainId, brainType: "person_clone" },
            headers: { Authorization: `Bearer ${session?.access_token}` },
          });
          queryClient.invalidateQueries({ queryKey: ["brain_analysis", brainId] });
          refetch();
        } catch (error) {
          console.error("Failed to auto-upgrade clone:", error);
        } finally {
          setIsUpgrading(false);
        }
      };
      upgradeClone();
    }
  }, [analysis, brainId, isUpgrading, queryClient, refetch]);

  if (isLoading || isUpgrading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border border-white/5 bg-white/[0.02] rounded-3xl min-h-[400px]">
        <div className="relative">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4 relative z-10" />
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
        </div>
        <p className="text-xs font-mono text-primary font-bold uppercase tracking-widest mt-2">
          {isUpgrading ? "Atualizando Biometria para OPME v2.0..." : "Sintetizando DNA Cognitivo..."}
        </p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border border-white/5 bg-white/[0.02] rounded-3xl min-h-[400px] text-center">
        <Fingerprint className="h-12 w-12 text-white/10 mb-4" />
        <p className="text-sm text-muted-foreground">O DNA Cognitivo ainda não foi extraído para este ativo.</p>
      </div>
    );
  }

  // Prepared Data
  const traitData = analysis.personality_traits
    ? Object.entries(analysis.personality_traits).map(([trait, value]) => ({
        trait: trait.charAt(0).toUpperCase() + trait.slice(1),
        // Normalize 0-10 to 0-100 for the radar domain
        value: typeof value === 'number' ? (value <= 10 ? value * 10 : value) : 50,
      }))
    : [];

  const commStyle = (analysis.communication_style || {}) as Record<string, number>;
  const commData = [
    { name: "Formalidade", value: (commStyle.formalidade || 5) * 10 },
    { name: "Humor", value: (commStyle.humor || 5) * 10 },
    { name: "Vocabulário", value: (commStyle.riqueza_vocabular || 5) * 10 },
    { name: "Diretividade", value: (commStyle.diretividade || 5) * 10 },
    { name: "Emoção", value: (commStyle.expressividade_emocional || 5) * 10 }
  ];

  const hexaco = analysis.hexaco as Record<string, number> || {};
  const hexacoData = [
    { name: "H-Humildade", value: (hexaco.honesty_humility || 5) * 10 },
    { name: "Emocionalidade", value: (hexaco.emotionality || 5) * 10 },
    { name: "Extroversão", value: (hexaco.extraversion || 5) * 10 },
    { name: "Afabilidade", value: (hexaco.agreeableness || 5) * 10 },
    { name: "Escrupulosidade", value: (hexaco.conscientiousness || 5) * 10 },
    { name: "Abertura", value: (hexaco.openness || 5) * 10 }
  ];

  const handleRecalculate = async () => {
    setIsUpgrading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.functions.invoke("analyze-brain", {
        body: { brainId, brainType: "person_clone" },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      queryClient.invalidateQueries({ queryKey: ["brain_analysis", brainId] });
      refetch();
    } catch (error) {
      console.error("Failed to manual upgrade clone:", error);
    } finally {
      setIsUpgrading(false);
    }
  };

  const disc = analysis.disc_profile as Record<string, string | number | boolean | null>;
  const dna = analysis.cognitive_dna as Record<string, string | number | boolean | null>;
  const voice = analysis.voice_patterns as Record<string, string | string[] | number | null>;
  const phrases = analysis.signature_phrases as string[] || [];
  const ocean = analysis.big_five as Record<string, number> || {};
  const themes = analysis.frequent_themes as Array<{ name: string; count: number }> || [];
  const skillsRaw = analysis.skills as Record<string, number> || {};
  const skillsEvaluation = analysis.skills_evaluation as string || "";

  const oceanData = [
    { name: "Abertura", value: ocean.openness || 50, color: "#3b82f6" },
    { name: "Conscienciosidade", value: ocean.conscientiousness || 50, color: "#8b5cf6" },
    { name: "Extroversão", value: ocean.extraversion || 50, color: "#10b981" },
    { name: "Amabilidade", value: ocean.agreeableness || 50, color: "#f59e0b" },
    { name: "Neuroticismo", value: ocean.neuroticism || 50, color: "#ef4444" },
  ];

  const skillsData = Object.entries(skillsRaw)
    .slice(0, 10)
    .map(([name, score]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value: Math.round((Number(score) || 0) * 10),
      fill: COLORS[Math.floor(Math.random() * COLORS.length)],
    }))
    .sort((a, b) => b.value - a.value);

  const sortedThemes = [...themes].sort((a, b) => b.count - a.count).slice(0, 8);
  const maxThemeCount = sortedThemes[0]?.count || 1;

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      
      {/* Header Badges */}
      <div className="flex flex-wrap gap-2 items-center px-2">
        <div className="flex items-center gap-2 mr-4">
          <Fingerprint className="h-5 w-5 text-primary" />
          <h3 className="text-xl font-black italic tracking-tighter text-white">OPME MAPPING</h3>
        </div>
        {analysis.mbti && (
          <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-[10px] font-black text-blue-400 uppercase tracking-widest hover:bg-blue-500/20 transition-colors">
            MBTI: {analysis.mbti}
          </div>
        )}
        {analysis.enneagram && (
          <div className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-[10px] font-black text-purple-400 uppercase tracking-widest hover:bg-purple-500/20 transition-colors">
            ENGRM: {analysis.enneagram}
          </div>
        )}
        {disc?.dominant && (
          <div className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-[10px] font-black text-green-400 uppercase tracking-widest hover:bg-green-500/20 transition-colors">
            DISC: {disc.dominant}
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRecalculate}
          disabled={isUpgrading}
          className="ml-auto h-8 gap-2 rounded-xl border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 text-[10px] font-black uppercase tracking-widest"
        >
          <RefreshCw className={cn("h-3 w-3", isUpgrading && "animate-spin")} />
          Recalcular DNA (OPME v2.0)
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Core Traits Radar */}
        <Card className="lg:col-span-1 bg-white/[0.02] border-white/5 shadow-2xl rounded-3xl overflow-hidden backdrop-blur-md hover:border-primary/20 transition-all duration-500 group">
          <CardHeader className="pb-0 border-b border-white/5 bg-white/[0.01]">
            <CardTitle className="text-sm font-black tracking-widest uppercase flex items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
              <Activity className="h-4 w-4" />
              Pegada Emocional
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[320px] p-4 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={traitData}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                <PolarAngleAxis 
                  dataKey="trait" 
                  tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 700 }} 
                />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  name="Score"
                  dataKey="value"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="#3b82f6"
                  fillOpacity={0.25}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0c0c0d', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ color: '#3b82f6', fontWeight: 800 }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Big Five (OCEAN) / HEXACO Mapping */}
        <Card className="lg:col-span-2 bg-gradient-to-br from-[#121214] to-[#0a0a0c] border-white/5 shadow-2xl rounded-3xl overflow-hidden group">
          <CardHeader className="pb-0 border-b border-white/5 bg-white/[0.01] flex-row items-center justify-between">
            <CardTitle className="text-sm font-black tracking-widest uppercase flex items-center gap-2 text-muted-foreground group-hover:text-blue-400 transition-colors">
              <Network className="h-4 w-4" />
              Arquitetura de Personalidade ({activeModel === 'ocean' ? 'Big Five' : 'HEXACO'})
            </CardTitle>
            <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
               <button 
                 onClick={() => setActiveModel('ocean')}
                 className={cn("px-2 py-1 text-[9px] font-black uppercase transition-all rounded-md", activeModel === 'ocean' ? "bg-primary text-white" : "text-muted-foreground hover:text-white")}
               >
                 OCEAN
               </button>
               <button 
                 onClick={() => setActiveModel('hexaco')}
                 className={cn("px-2 py-1 text-[9px] font-black uppercase transition-all rounded-md", activeModel === 'hexaco' ? "bg-primary text-white" : "text-muted-foreground hover:text-white")}
               >
                 HEXACO
               </button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activeModel === 'ocean' ? oceanData : hexacoData} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: 800 }} 
                      width={100}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                      contentStyle={{ backgroundColor: '#0c0c0d', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
                      {(activeModel === 'ocean' ? oceanData : hexacoData).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <h4 className="text-[10px] uppercase tracking-widest text-primary mb-2 font-black">Meta-Análise Cognitiva</h4>
                  <p className="text-[11px] text-white/80 leading-relaxed font-bold italic">
                    {dna?.archetype || "Sintetizando arquétipo central do sujeito baseado no corpus extraído..."}
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed px-1">
                  O modelo OCEAN fornece a base para a simulação de respostas comportamentais de alta fidelidade no OPME v2.0.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Communication & Voice Style - Re-adapted to occupy bottom row */}
        <Card className="lg:col-span-3 bg-gradient-to-br from-[#121214] to-[#0a0a0c] border-white/5 shadow-2xl rounded-3xl overflow-hidden group">
          <CardHeader className="pb-0 border-b border-white/5 bg-white/[0.01]">
            <CardTitle className="text-sm font-black tracking-widest uppercase flex items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
              <Waves className="h-4 w-4" />
              Sintaxe & Ritmo de Comunicação
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={commData} layout="vertical" margin={{ top: 0, right: 30, left: 30, bottom: 0 }}>
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 700 }} width={90} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                    contentStyle={{ backgroundColor: '#0c0c0d', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                    {commData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-bold">Intensificadores Vocais</h4>
                <div className="flex flex-wrap gap-1.5">
                  {(voice?.intensifiers as string[] | undefined)?.slice(0, 5).map((w: string, i: number) => (
                    <span key={i} className="px-2 py-1 bg-white/5 rounded-md text-[10px] text-white/70 italic border border-white/5">
                      {w}
                    </span>
                  )) || <span className="text-xs text-white/30">Dados insuficientes</span>}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-bold">Padrões Estruturais</h4>
                <p className="text-[11px] text-white/70 leading-relaxed font-medium">
                  {voice?.patterns?.[0] || disc?.logic || "Formação de sentenças padronizada baseada em contexto direto."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lexicon & Expressions */}
      {phrases.length > 0 && (
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-4 w-4 text-green-400" />
            <h4 className="text-xs font-black tracking-widest uppercase text-green-400">Fingerprint Lexical (Expressões Assinatura)</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {phrases.map((phrase, i) => (
              <div key={i} className="px-4 py-2 bg-[#0c0c0d] border border-white/10 rounded-xl text-xs font-mono text-white/80 hover:border-green-400/50 hover:text-green-400 transition-colors cursor-default">
                "{phrase}"
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Heuristics and Shadow Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-gradient-to-br from-blue-900/10 to-transparent border border-blue-500/20 rounded-3xl hover:border-blue-500/40 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <Network className="h-5 w-5 text-blue-400" />
            <h4 className="text-sm font-black tracking-widest uppercase text-blue-400">Heurísticas de Decisão</h4>
          </div>
          <p className="text-xs text-white/70 leading-loose">
            {dna?.heuristics || "Matriz de decisão não mapeada. Requer maior volume de dados qualitativos para sintetizar raízes decisórias."}
          </p>
        </div>
        
        <div className="p-6 bg-gradient-to-br from-yellow-900/10 to-transparent border border-yellow-500/20 rounded-3xl hover:border-yellow-500/40 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5 text-yellow-400" />
            <h4 className="text-sm font-black tracking-widest uppercase text-yellow-400">Shadow Mapping</h4>
          </div>
          <p className="text-xs text-white/70 leading-loose">
            {dna?.shadow || "Aspectos sombrios não identificados. O perfil apresenta baixa variância negativa no corpus atual."}
          </p>
        </div>
      </div>

      {/* Row: Skills & Themes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Skills Radial */}
        <Card className="bg-white/[0.02] border-white/5 shadow-2xl rounded-3xl overflow-hidden group">
          <CardHeader className="pb-0 border-b border-white/5 bg-white/[0.01]">
            <CardTitle className="text-sm font-black tracking-widest uppercase flex items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
              <Zap className="h-4 w-4 text-yellow-500" />
              Mapeamento de Competências
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart cx="50%" cy="50%" innerRadius="25%" outerRadius="90%" data={skillsData} startAngle={90} endAngle={-270}>
                  <RadialBar dataKey="value" cornerRadius={6} background={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0c0c0d', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    itemStyle={{ fontSize: 11, fontWeight: 800 }}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
            {skillsEvaluation && (
              <div className="mt-4 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                <p className="text-[11px] text-white/70 italic leading-relaxed">
                  {skillsEvaluation}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Frequent Themes */}
        <Card className="bg-white/[0.02] border-white/5 shadow-2xl rounded-3xl overflow-hidden group">
          <CardHeader className="pb-0 border-b border-white/5 bg-white/[0.01]">
            <CardTitle className="text-sm font-black tracking-widest uppercase flex items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
              <Activity className="h-4 w-4 text-blue-400" />
              Temas e Conceitos Recorrentes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
             <div className="space-y-4">
               {sortedThemes.map((theme, i) => (
                 <div key={theme.name} className="space-y-1">
                   <div className="flex justify-between text-[10px] font-bold uppercase tracking-tighter">
                     <span className="text-white/80">{theme.name}</span>
                     <span className="text-primary">{theme.count} ocorrências</span>
                   </div>
                   <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                     <div 
                        className="h-full bg-primary/40 rounded-full" 
                        style={{ width: `${(theme.count / maxThemeCount) * 100}%` }}
                     />
                   </div>
                 </div>
               ))}
             </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

