import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

  const { data: analysis, isLoading, refetch } = useQuery({
    queryKey: ["brain_analysis", brainId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brain_analysis")
        .select("*")
        .eq("brain_id", brainId)
        .single();
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
        value: typeof value === 'number' ? value : 50,
      }))
    : [];

  const commStyle = analysis.communication_style || {};
  const commData = [
    { name: "Cadência", value: commStyle.tempo || 50 },
    { name: "Complexidade", value: commStyle.complexity || 50 },
    { name: "Ritmo", value: commStyle.rhythm || 50 }
  ];

  const disc = analysis.disc_profile as Record<string, any>;
  const dna = analysis.cognitive_dna as Record<string, any>;
  const voice = analysis.voice_patterns as Record<string, any>;
  const phrases = analysis.signature_phrases as string[] || [];

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

        {/* Communication & Voice Style */}
        <Card className="lg:col-span-2 bg-gradient-to-br from-[#121214] to-[#0a0a0c] border-white/5 shadow-2xl rounded-3xl overflow-hidden group">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-black tracking-widest uppercase flex items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
              <Waves className="h-4 w-4" />
              Sintaxe & Ritmo de Comunicação
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={commData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700 }} width={80} />
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
                  {voice?.intensifiers?.slice(0, 5).map((w: string, i: number) => (
                    <span key={i} className="px-2 py-1 bg-white/5 rounded-md text-[10px] text-white/70 italic border border-white/5">
                      {w}
                    </span>
                  )) || <span className="text-xs text-white/30">Dados insuficientes</span>}
                </div>
              </div>
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

    </div>
  );
}

