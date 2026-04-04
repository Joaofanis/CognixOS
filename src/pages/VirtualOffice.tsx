import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Bot, 
  Briefcase, 
  ChevronRight, 
  Cpu, 
  FileText, 
  Layers, 
  Loader2, 
  Network, 
  Send, 
  Sparkles, 
  Users,
  Building,
  Activity,
  HardDrive,
  MessageSquare,
  Monitor,
  LayoutDashboard,
  CheckCircle2,
  FolderOpen
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import ObsidianMarkdown from "@/components/ObsidianMarkdown";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface OfficeEvent {
  type: string;
  message?: string;
  vision?: string;
  squadId?: string;
  agent?: string;
  role?: string;
  agentName?: string;
  content?: string;
  iteration?: number;
  finalReport?: string;
  clonedFrom?: string;
}

export default function VirtualOffice() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [events, setEvents] = useState<OfficeEvent[]>([]);
  const [squad, setSquad] = useState<{name: string, role: string, clonedFrom?: string, status: 'idle' | 'working'}[]>([]);
  const [finalReport, setFinalReport] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("office");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter for agent reports (Data Storage)
  const reports = events.filter(e => e.type === "agent_report");

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  // Sync existing data on mount (Last Active Squad)
  useEffect(() => {
    const syncOffice = async () => {
      const { data: { session } } = await (window as any).supabase.auth.getSession();
      if (!session) return;

      const { data: latestSquad } = await (window as any).supabase
        .from('squads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (latestSquad) {
        // Fetch Agents
        const { data: agents } = await (window as any).supabase
          .from('subagents')
          .select('*')
          .eq('squad_id', latestSquad.id);
        
        if (agents) {
          setSquad(agents.map((a: any) => ({ 
            name: a.name, 
            role: a.role, 
            clonedFrom: a.cloned_from,
            status: 'idle' 
          })));
        }

        // Fetch Messages/Reports
        const { data: messages } = await (window as any).supabase
          .from('squad_messages')
          .select('*')
          .eq('squad_id', latestSquad.id)
          .order('created_at', { ascending: true });

        if (messages) {
          const syncEvents = messages.map((m: any) => ({
             type: m.type === 'report' ? 'agent_report' : 'message',
             agentName: agents?.find(a => a.id === m.sender_id)?.name || 'Agent',
             content: m.content
          }));
          setEvents(syncEvents);
          if (latestSquad.final_report) setFinalReport(latestSquad.final_report);
        }
      }
    };
    syncOffice();
  }, []);

  const handleLaunch = async () => {
    if (!challenge.trim()) return;
    
    setIsWorking(true);
    setEvents([]);
    setSquad([]);
    setFinalReport(null);

    try {
      const { data: { session } } = await (window as any).supabase.auth.getSession();
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/virtual-office`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ challenge }),
      });

      if (!response.ok) throw new Error("Falha ao iniciar escritório");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6)) as OfficeEvent;
              setEvents(prev => [...prev, data]);

              if (data.type === "hired") {
                setSquad(prev => [...prev, { 
                  name: data.agent!, 
                  role: data.role!, 
                  clonedFrom: data.clonedFrom,
                  status: 'idle' 
                }]);
              }
              if (data.type === "agent_working") {
                setSquad(prev => prev.map(a => ({
                  ...a,
                  status: a.name === data.agentName ? 'working' : 'idle'
                })));
              }
              if (data.type === "agent_report") {
                setSquad(prev => prev.map(a => ({ ...a, status: 'idle' })));
              }
              if (data.type === "done" && data.finalReport) {
                setFinalReport(data.finalReport);
                setIsWorking(false);
                setSquad(prev => prev.map(a => ({ ...a, status: 'idle' })));
              }
            } catch (e) {
              console.error("Error parsing event", e);
            }
          }
        }
      }
    } catch (err: any) {
      toast.error(err.message);
      setIsWorking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-foreground flex flex-col font-sans overflow-hidden">
      {/* Header Premium */}
      <header className="h-16 border-b border-white/5 bg-black/40 backdrop-blur-xl flex items-center px-6 justify-between shrink-0 z-50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="hover:bg-white/5 rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="h-px w-8 bg-white/10 hidden md:block" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Building className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tighter uppercase">Virtual Office AIOS</h1>
              <p className="text-[10px] text-muted-foreground font-mono">STATUS: {isWorking ? 'MISSION_ACTIVE' : 'IDLE'}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="hidden md:flex">
            <TabsList className="bg-white/5 border border-white/10 h-9 p-1 rounded-xl">
              <TabsTrigger value="office" className="text-xs gap-2 data-[state=active]:bg-primary/20"><Monitor className="h-3.5 w-3.5" /> Planta 2D</TabsTrigger>
              <TabsTrigger value="storage" className="text-xs gap-2 data-[state=active]:bg-primary/20"><HardDrive className="h-3.5 w-3.5" /> Common Drive</TabsTrigger>
              <TabsTrigger value="chat" className="text-xs gap-2 data-[state=active]:bg-primary/20"><MessageSquare className="h-3.5 w-3.5" /> War Room</TabsTrigger>
            </TabsList>
          </Tabs>
          {finalReport && (
            <Button variant="outline" size="sm" className="rounded-xl border-white/10 hover:bg-white/5 h-9" onClick={() => { setFinalReport(null); setEvents([]); setSquad([]); setChallenge(""); }}>
              Reset Office
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

        {!isWorking && events.length === 0 && !finalReport ? (
          <div className="h-full flex items-center justify-center p-6 relative">
            <div className="max-w-2xl w-full space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
              <div className="text-center space-y-4">
                <Badge variant="outline" className="px-4 py-1 rounded-full border-primary/30 text-primary animate-pulse font-mono tracking-widest text-[10px]">COGNITIVE OPERATIONS CENTER</Badge>
                <h2 className="text-5xl font-black tracking-tight leading-none">Qual a missão do <br/><span className="text-primary italic underline underline-offset-8 decoration-primary/20">seu escritório?</span></h2>
                <p className="text-muted-foreground text-lg">Defina o desafio. O CEO montará o time ideal em segundos.</p>
              </div>

              <Card className="bg-black/60 border-white/5 backdrop-blur-2xl rounded-[32px] overflow-hidden shadow-2xl">
                <CardContent className="p-8 space-y-6">
                  <Textarea 
                    placeholder="Ex: Crie um briefing de marketing para um novo café artesanal focado no público gamer..."
                    className="min-h-[160px] bg-white/5 border-white/10 focus-visible:ring-primary/40 text-xl placeholder:text-white/20 resize-none rounded-2xl p-6"
                    value={challenge}
                    onChange={e => setChallenge(e.target.value)}
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex -space-x-2">
                       {[1,2,3,4].map(i => <div key={i} className="h-8 w-8 rounded-full border-2 border-black bg-white/5 flex items-center justify-center text-[10px] font-bold"><Bot className="h-4 w-4 opacity-40"/></div>)}
                    </div>
                    <Button onClick={handleLaunch} disabled={!challenge.trim() || isWorking} className="h-14 px-10 rounded-2xl bg-primary hover:bg-primary/90 text-lg font-bold transition-all hover:scale-105 active:scale-95 shadow-xl shadow-primary/20">
                      Iniciar Operação <ChevronRight className="ml-2 h-5 w-5"/>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col md:flex-row">
            {/* Viewport Principal */}
            <div className="flex-1 relative overflow-auto p-8">
              
              {activeTab === "office" && (
                <div className="h-full w-full min-h-[600px] flex items-center justify-center perspective-1000">
                  <div className="relative w-full max-w-4xl h-full flex flex-wrap items-center justify-center gap-12 p-12">
                    
                    {/* CEO STATION (Always present if processing) */}
                    <div className="w-full flex justify-center mb-4">
                      <AgentDesk 
                        name="CEO Architect" 
                        role="Master Orchestrator" 
                        status={isWorking && events.length < 5 ? 'working' : 'idle'}
                        isCEO
                      />
                    </div>

                    {/* SQUAD STATIONS */}
                    {squad.map((agent, i) => (
                      <AgentDesk 
                        key={i} 
                        name={agent.name} 
                        role={agent.role} 
                        clonedFrom={agent.clonedFrom}
                        status={agent.status}
                      />
                    ))}

                    {/* CENTRAL STORAGE RACK (VISUAL) */}
                    {(isWorking || reports.length > 0) && (
                       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 group cursor-pointer" onClick={() => setActiveTab("storage")}>
                          <div className="h-32 w-24 bg-gradient-to-b from-[#1a1a1a] to-[#050505] border border-white/5 rounded-lg shadow-2xl flex flex-col p-2 gap-1 items-center justify-center relative overflow-hidden group-hover:border-primary/40 transition-colors">
                             <div className="absolute inset-x-0 h-px top-2 bg-primary/20 animate-pulse" />
                             {[1,2,3,4,5].map(i => (
                               <div key={i} className="w-full h-2 bg-white/5 rounded-full flex items-center px-1 gap-1">
                                  <div className={`h-1 w-1 rounded-full ${reports.length > i ? 'bg-primary' : 'bg-white/10'}`} />
                                  <div className="h-0.5 flex-1 bg-white/5 rounded-full" />
                               </div>
                             ))}
                             <HardDrive className="h-6 w-6 text-primary mt-2 group-hover:scale-110 transition-transform" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground group-hover:text-primary transition-colors">Storage System</span>
                       </div>
                    )}

                    {/* Placeholder if hiring */}
                    {isWorking && squad.length < 2 && (
                       <div className="h-32 w-48 rounded-3xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-2 opacity-50">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span className="text-[10px] uppercase font-bold tracking-widest">Hiring Agents...</span>
                       </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "storage" && (
                <div className="h-full w-full max-w-5xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-3xl font-black">Common Drive</h2>
                      <p className="text-muted-foreground">Repositório de dados e relatórios gerados pelo squad.</p>
                    </div>
                    <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary">{reports.length} Arquivos</Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {reports.map((report, i) => (
                      <Card key={i} className="bg-white/5 border-white/10 hover:border-primary/40 transition-colors cursor-pointer group" onClick={() => setSelectedFile(report.content || '')}>
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <FileText className="h-6 w-6 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black truncate uppercase tracking-tighter">report_{report.agentName?.toLowerCase().replace(/\s/g, '_')}_{i}.md</p>
                            <p className="text-[10px] text-muted-foreground">Autor: {report.agentName}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {reports.length === 0 && (
                      <div className="col-span-full h-40 flex flex-col items-center justify-center gap-4 border border-dashed border-white/10 rounded-3xl opacity-30">
                        <FolderOpen className="h-8 w-8" />
                        <span className="text-sm">Nenhum arquivo gerado ainda.</span>
                      </div>
                    )}
                  </div>

                  {selectedFile && (
                    <Card className="bg-black/80 border-primary/20 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4">
                       <CardHeader className="flex flex-row items-center justify-between">
                          <CardTitle className="text-sm">Visualizador de Documentos</CardTitle>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedFile(null)}>Fechar</Button>
                       </CardHeader>
                       <CardContent className="p-8 prose prose-invert max-w-none">
                          <ObsidianMarkdown content={selectedFile} />
                       </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {activeTab === "chat" && (
                <div className="h-full flex flex-col bg-black/40 border border-white/5 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md">
                   <div className="h-12 border-b border-white/5 bg-white/5 flex items-center px-4 justify-between">
                      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                         <div className="h-1.5 w-1.5 bg-primary rounded-full animate-pulse" />
                         Live Inter-Agent Feed
                      </div>
                      <Badge variant="outline" className="text-[9px] h-5 opacity-50">ENC-256V</Badge>
                   </div>
                   <ScrollArea ref={scrollRef as any} className="flex-1 p-6 font-mono text-[11px] leading-relaxed">
                      <div className="space-y-3">
                         {events.map((ev, i) => (
                           <div key={i} className="animate-in fade-in duration-300">
                             <span className="text-white/20 mr-2">[{new Date().toLocaleTimeString()}]</span>
                             {ev.type === "planning" && <span className="text-primary pr-2">CEO:</span>}
                             {ev.type === "hiring" && <span className="text-violet-400 pr-2">RH:</span>}
                             {ev.type === "agent_working" && <span className="text-amber-400 pr-2">{ev.agentName?.toUpperCase()}:</span>}
                             {ev.type === "agent_report" && <span className="text-emerald-400 pr-2">{ev.agentName?.toUpperCase()}:</span>}
                             <span className="text-white/60">{ev.message || ev.vision || `Transmitting telemetry data...`}</span>
                           </div>
                         ))}
                         {isWorking && (
                            <div className="flex gap-1.5 py-4">
                               <div className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce" />
                               <div className="h-1.5 w-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:200ms]" />
                               <div className="h-1.5 w-1.5 bg-primary/30 rounded-full animate-bounce [animation-delay:400ms]" />
                            </div>
                         )}
                      </div>
                   </ScrollArea>
                </div>
              )}
            </div>

            {/* Sidebar de Conclusão (Final Report) */}
            {finalReport && (
              <div className="w-full md:w-[450px] border-l border-white/10 bg-black/60 backdrop-blur-3xl p-8 flex flex-col gap-6 animate-in slide-in-from-right duration-500 z-40">
                <div className="space-y-2">
                  <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(var(--primary-rgb),0.4)]">
                    <CheckCircle2 className="h-6 w-6 text-black" />
                  </div>
                  <h3 className="text-2xl font-black italic tracking-tighter">Missão Cumprida</h3>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Relatório Executivo Finalizado</p>
                </div>

                <ScrollArea className="flex-1 -mx-4 px-4 overflow-x-hidden">
                  <div className="prose prose-invert prose-sm max-w-none pb-12">
                    <ObsidianMarkdown content={finalReport} />
                  </div>
                </ScrollArea>
                
                <Button className="w-full h-14 rounded-2xl bg-white text-black hover:bg-white/90 font-black tracking-tight" onClick={() => {
                   const blob = new Blob([finalReport!], { type: 'text/markdown' });
                   const url = window.URL.createObjectURL(blob);
                   const a = document.createElement('a');
                   a.href = url;
                   a.download = `squad_final_report_${new Date().getTime()}.md`;
                   a.click();
                }}>
                  Exportar Relatórios (.zip)
                </Button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// Subcomponente Desk 2D
function AgentDesk({ name, role, status, clonedFrom, isCEO }: { name: string, role: string, status: 'idle' | 'working', clonedFrom?: string, isCEO?: boolean }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`relative transition-all duration-700 animate-in zoom-in-95 group/desk ${status === 'working' ? 'scale-110' : 'scale-100 hover:scale-105'} cursor-help`}>
            {/* Luz de Status (LED) */}
            <div className={`absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-black z-10 transition-all duration-300 ${status === 'working' ? 'bg-primary shadow-[0_0_10px_#8b5cf6]' : 'bg-white/10'}`} />
            
            {/* Avatar/Icone com Glow se trabalhar */}
            <div className={`h-24 w-40 rounded-3xl border backdrop-blur-md flex flex-col items-center justify-center p-4 transition-all duration-500 overflow-hidden ${isCEO ? 'bg-primary/10 border-primary/40' : 'bg-white/5 border-white/10 group-hover/desk:border-primary/40'}`}>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-3 transition-colors ${isCEO ? 'bg-primary text-black' : 'bg-white/10 text-white/40 group-hover/desk:text-primary'}`}>
                 {isCEO ? <Building className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
              </div>
              <div className="text-center min-w-0 w-full px-2">
                <p className="text-[10px] font-black truncate uppercase tracking-tighter text-white">{name}</p>
                <p className="text-[8px] text-primary/80 truncate font-bold opacity-80 tracking-normal uppercase">{role}</p>
                {clonedFrom && (
                  <div className="mt-1 flex items-center justify-center gap-1 border-t border-white/5 pt-1">
                    <span className="text-[7px] text-muted-foreground uppercase opacity-60">Clone de:</span>
                    <span className="text-[7px] text-primary font-black uppercase truncate max-w-[80px]">{clonedFrom}</span>
                  </div>
                )}
              </div>

              {/* Efeito de Scan se tiver trabalhando */}
              {status === 'working' && (
                <div className="absolute inset-x-0 top-0 h-1 bg-primary/40 animate-scan-y opacity-50" />
              )}
            </div>

            {/* Rótulo de Tarefa se estiver trabalhando */}
            {status === 'working' && (
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary/20 border border-primary/30 rounded-full animate-bounce whitespace-nowrap">
                 <span className="text-[8px] font-black text-primary uppercase tracking-widest">Processing Cognitive Data...</span>
              </div>
            )}
          </div>
        </TooltipTrigger>
        {!isCEO && (
          <TooltipContent side="top" className="bg-black/90 border-white/10 backdrop-blur-xl p-4 rounded-2xl max-w-xs shadow-2xl">
             <div className="space-y-2">
                <p className="text-[10px] font-black uppercase text-primary tracking-widest border-b border-primary/20 pb-1">Cognitive Matrix Unlocked</p>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                   <div className="flex flex-col"><span className="text-muted-foreground uppercase opacity-50 text-[8px]">Base</span><span className="font-bold">{clonedFrom || 'Expert Standard'}</span></div>
                   <div className="flex flex-col"><span className="text-muted-foreground uppercase opacity-50 text-[8px]">Status</span><span className="text-emerald-400 font-bold">SYNT_OK</span></div>
                </div>
                <p className="text-[9px] leading-tight text-white/70 italic bg-white/5 p-2 rounded-lg border border-white/5">"Este agente opera sob uma simulação de alta fidelidade do framework estratégico de {clonedFrom || 'especialistas do setor'}."</p>
             </div>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
