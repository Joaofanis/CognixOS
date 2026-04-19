import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  LineChart, Line, CartesianGrid
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Fingerprint, ShieldCheck, Zap, Activity, Info, 
  Binary, GitBranch, Scale, ShieldAlert, Cpu
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ForensicDashboardProps {
  brainId: string;
}

const HEXACO_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4"];

export default function ForensicDashboard({ brainId }: ForensicDashboardProps) {
  const { data: analysis, isLoading } = useQuery({
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

  if (isLoading || !analysis) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
        <Activity className="h-10 w-10 animate-pulse text-primary mb-4" />
        <p className="text-xs font-mono text-primary animate-pulse uppercase tracking-widest">
          Calculando Métricas Forenses...
        </p>
      </div>
    );
  }

  const hexacoRaw = analysis.hexaco as Record<string, number> || {};
  const hexacoData = [
    { trait: "H", full: "Honesty-Humility", value: (hexacoRaw.honesty_humility || 5) * 10 },
    { trait: "E", full: "Emotionality", value: (hexacoRaw.emotionality || 5) * 10 },
    { trait: "X", full: "Extraversion", value: (hexacoRaw.extraversion || 5) * 10 },
    { trait: "A", full: "Agreeableness", value: (hexacoRaw.agreeableness || 5) * 10 },
    { trait: "C", full: "Conscientiousness", value: (hexacoRaw.conscientiousness || 5) * 10 },
    { trait: "O", full: "Openness", value: (hexacoRaw.openness || 5) * 10 },
  ];

  const forensic = analysis.forensic_stylometry as Record<string, any> || {};
  const chronicle = analysis.identity_chronicle as Record<string, any> || {};
  const fidelity = analysis.fidelity_scores as Record<string, number> || {};

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      
      {/* --- INFRASTRUCTURE HEADER --- */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_20px_-5px_rgba(59,130,246,0.5)]">
            <Fingerprint className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-black italic tracking-tighter text-white uppercase">ID-FOR FORENSICS</h2>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">OPME V2.0 High Fidelity Protocol — ID-RAG Architecture</p>
          </div>
        </div>
        <div className="flex gap-2">
          {fidelity.adherence && (
            <div className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-lg text-[10px] font-black text-green-400">
              EVAL4SIM: {fidelity.adherence}% ADHERENCE
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* --- HEXACO RADAR --- */}
        <Card className="bg-black/40 border-white/5 shadow-2xl rounded-3xl overflow-hidden backdrop-blur-xl group border-l-primary/30 border-l-2">
          <CardHeader className="pb-0 border-b border-white/5 flex flex-row items-center justify-between">
            <CardTitle className="text-[10px] font-black tracking-[0.2em] uppercase text-muted-foreground">
              Fundamentos Lexicais (HEXACO)
            </CardTitle>
            <ShieldCheck className="h-4 w-4 text-primary opacity-50" />
          </CardHeader>
          <CardContent className="h-[300px] p-2">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={hexacoData}>
                <PolarGrid stroke="rgba(255,255,255,0.05)" />
                <PolarAngleAxis 
                  dataKey="trait" 
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 900 }} 
                />
                <Radar
                   name="Dimenção"
                   dataKey="value"
                   stroke="#3b82f6"
                   strokeWidth={2}
                   fill="#3b82f6"
                   fillOpacity={0.3}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0c0c0d', border: 'none', borderRadius: '8px', fontSize: '10px' }}
                />
              </RadarChart>
            </ResponsiveContainer>
            <div className="px-4 pb-4">
               <p className="text-[9px] text-muted-foreground italic text-center leading-relaxed">
                 O modelo HEXACO identifica traços de **Honestidade-Humildade**, fundamentais para a governança de identidades públicas.
               </p>
            </div>
          </CardContent>
        </Card>

        {/* --- FORENSIC FINGERPRINTS --- */}
        <Card className="lg:col-span-2 bg-black/20 border-white/5 rounded-3xl overflow-hidden group">
          <CardHeader className="pb-0 border-b border-white/5">
            <CardTitle className="text-[10px] font-black tracking-[0.2em] uppercase text-muted-foreground flex items-center gap-2">
              <Binary className="h-4 w-4" /> Assinatura Estilométrica Forense
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-1.5 px-0.5">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Riqueza Lexical (Hapax Ratio)</span>
                    <span className="text-[10px] font-black text-primary font-mono">{forensic.hapax_legomena_ratio?.toFixed(1)}%</span>
                  </div>
                  <Progress value={forensic.hapax_legomena_ratio} className="h-1.5 bg-white/5" />
                </div>
                <div>
                  <div className="flex justify-between mb-1.5 px-0.5">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Fidelidade Eval4Sim (Consistency)</span>
                    <span className="text-[10px] font-black text-green-400 font-mono">{fidelity.consistency}%</span>
                  </div>
                  <Progress value={fidelity.consistency} className="h-1.5 bg-white/5" indicatorClassName="bg-green-500" />
                </div>
                <div className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl">
                  <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-3 flex items-center gap-2">
                    <Zap className="h-3 w-3 text-yellow-500" /> Padrões de Micro-Sintaxe
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {forensic.signature_patterns?.map((p: string, i: number) => (
                      <span key={i} className="px-2 py-1 bg-black/40 border border-white/10 rounded-md text-[9px] font-mono text-white/50 italic capitalize">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                 <div className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl h-full">
                    <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-3 flex items-center gap-2">
                      <Scale className="h-3 w-3 text-blue-400" /> Governança & LGPD (Art. 18)
                    </h4>
                    <p className="text-[10px] text-white/60 leading-relaxed font-medium">
                      O perfil cognitivo foi reconstruído através de análise estilométrica naturalística. 
                      A **Complexidade Sintática** detectada é <span className="text-primary font-black uppercase">{forensic.syntax_complexity || "não mapeada"}</span>.
                    </p>
                    <div className="mt-4 pt-4 border-t border-white/5">
                      <div className="flex items-center gap-2 text-[9px] font-bold text-muted-foreground">
                         <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                         Auditabilidade: Alinhamento de Idioleto Validado
                      </div>
                    </div>
                 </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* --- N-GRAM FINGERPRINT --- */}
        <Card className="bg-black/20 border-white/5 rounded-3xl overflow-hidden group">
          <CardHeader className="pb-0 border-b border-white/5">
            <CardTitle className="text-[10px] font-black tracking-[0.2em] uppercase text-muted-foreground flex items-center gap-2">
              <GitBranch className="h-4 w-4" /> Distribuição de N-Grams (n=3)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[200px] p-4">
             {forensic.char_n_grams ? (
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={forensic.char_n_grams}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                   <XAxis 
                     dataKey="gram" 
                     axisLine={false} 
                     tickLine={false} 
                     tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 900 }} 
                   />
                   <YAxis hide domain={[0, 'dataMax + 5']} />
                   <Tooltip 
                     cursor={{ fill: 'transparent' }}
                     contentStyle={{ backgroundColor: '#0c0c0d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                   />
                   <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30}>
                     {forensic.char_n_grams.map((_: any, index: number) => (
                       <Cell key={`cell-${index}`} fillOpacity={1 - (index * 0.08)} />
                     ))}
                   </Bar>
                 </BarChart>
               </ResponsiveContainer>
             ) : (
               <div className="flex items-center justify-center h-full text-[10px] text-muted-foreground italic">
                 Aguardando nova extração n-gram...
               </div>
             )}
          </CardContent>
        </Card>

      </div>

      {/* --- IDENTITY CHRONICLE (ID-RAG GRAPH VIEW) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <Card className="bg-black/20 border-white/5 rounded-3xl overflow-hidden group lg:col-span-1">
          <CardHeader className="pb-0 border-b border-white/5">
            <CardTitle className="text-[10px] font-black tracking-[0.2em] uppercase text-muted-foreground flex items-center gap-2">
              <Cpu className="h-4 w-4" /> Loop de Decisão ID-RAG
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-4 group/item">
              <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-black text-primary">$\omega$</div>
              <p className="text-[10px] text-white/70 font-bold uppercase tracking-tight">Formulação de Query Cognitiva</p>
            </div>
            <div className="pl-4 border-l-2 border-white/5 space-y-4 ml-4 py-2">
               <div className="p-3 bg-white/[0.03] rounded-xl border border-white/5">
                  <h5 className="text-[8px] font-black uppercase text-muted-foreground mb-1.5">Recuperação de Crenças ($K_{ID,t}$)</h5>
                  <div className="space-y-1.5">
                    {chronicle.core_beliefs?.slice(0, 3).map((b: string, i: number) => (
                      <div key={i} className="flex gap-2 items-start">
                        <div className="h-1 w-1 rounded-full bg-primary mt-1 shrink-0" />
                        <span className="text-[10px] text-white/80 italic font-medium leading-tight">{b}</span>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
            <div className="flex items-center gap-4 mt-2">
              <div className="h-8 w-8 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-[10px] font-black text-green-500">$A_t$</div>
              <p className="text-[10px] text-white/70 font-bold uppercase tracking-tight">Ação Condicionada à Persona</p>
            </div>
          </CardContent>
        </Card>

        {/* --- HIERARCHY OF VALUES --- */}
        <Card className="lg:col-span-2 bg-gradient-to-br from-black/40 to-transparent border-white/5 rounded-3xl overflow-hidden group">
          <CardHeader className="pb-0 border-b border-white/5">
             <CardTitle className="text-[10px] font-black tracking-[0.2em] uppercase text-muted-foreground flex items-center gap-2">
              <GitBranch className="h-4 w-4" /> Crônica de Identidade & Valores
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-4">
                  <h4 className="text-[9px] font-black uppercase text-primary tracking-widest px-1">Hierarquia de Valores Centrais</h4>
                  <div className="space-y-2">
                    {chronicle.value_hierarchy?.map((v: string, i: number) => (
                      <div key={i} className="group/val relative flex items-center gap-3 p-2 bg-white/[0.02] hover:bg-white/[0.05] rounded-xl border border-white/5 transition-all">
                        <span className="text-[10px] font-black text-muted-foreground/50 w-4">0{i+1}</span>
                        <span className="text-xs font-bold text-white/90">{v}</span>
                      </div>
                    ))}
                    {!chronicle.value_hierarchy?.length && <p className="text-xs text-muted-foreground p-4 italic">Dados de valor não sintetizados.</p>}
                  </div>
               </div>
               <div className="space-y-4">
                  <h4 className="text-[9px] font-black uppercase text-muted-foreground tracking-widest px-1">Narrativa Arquetípica Principal</h4>
                  <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl shadow-inner">
                    <p className="text-[11px] text-white/80 leading-relaxed font-bold italic">
                      {chronicle.archetypal_narrative || "Sintetizando o papel social dominante através de análise ID-RAG..."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-xl">
                    <ShieldAlert className="h-3 w-3 text-yellow-500" />
                    <p className="text-[9px] text-yellow-500/80 font-black uppercase tracking-tighter">Guardrail: Alinhamento Ético LGPD Monitorado</p>
                  </div>
               </div>
             </div>
          </CardContent>
        </Card>

      </div>

    </div>
  );
}
