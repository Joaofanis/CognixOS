import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Activity, 
  ArrowLeft, 
  Bot, 
  Cog, 
  Plus, 
  Trash2, 
  Wrench, 
  Building, 
  Factory, 
  Terminal, 
  CheckCircle2, 
  Loader2, 
  Zap,
  Box,
  Layers,
  Search,
  MessageSquare,
  ShieldCheck,
  Target,
  ShieldAlert,
  Shield
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import SecurityDashboard from "@/components/SecurityDashboard";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSquadSync } from "@/contexts/SquadSyncContext";
import { cn } from "@/lib/utils";

const SQUAD_STATIONS = [
  { id: "RAG", name: "Fonte de Conhecimento", icon: Box, color: "text-blue-500", bg: "bg-blue-500/10" },
  { id: "Analista", name: "Mapeamento DISC", icon: Search, color: "text-purple-500", bg: "bg-purple-500/10" },
  { id: "Psicanalista", name: "Bio-Shadow Map", icon: Activity, color: "text-pink-500", bg: "bg-pink-500/10" },
  { id: "Linguista", name: "Sintaxe Digivoice", icon: MessageSquare, color: "text-orange-500", bg: "bg-orange-500/10" },
  { id: "Estrategista", name: "Stress Testing", icon: Target, color: "text-red-500", bg: "bg-red-500/10" },
  { id: "Verificador", name: "QA Compliance", icon: ShieldCheck, color: "text-green-500", bg: "bg-green-500/10" },
  { id: "Prompter", name: "Engenharia Final", icon: Zap, color: "text-yellow-500", bg: "bg-yellow-500/10" },
];

export default function AIOS() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("subagents");
  const { isSyncing, currentAgent, message, logs, progress } = useSquadSync();

  // Fetch Subagents
  const { data: subagents, isLoading: loadingAgents } = useQuery({
    queryKey: ["subagents", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("subagents").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch Skills
  const { data: skills, isLoading: loadingSkills } = useQuery({
    queryKey: ["agent_skills", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("agent_skills").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const [newAgent, setNewAgent] = useState({ name: "", role: "", system_prompt: "", preferred_model: "google/gemini-2.5-flash-lite" });
  const [isAgentDialogOpen, setAgentDialogOpen] = useState(false);
  const [newSkill, setNewSkill] = useState({ name: "", description: "", trigger_word: "", content: "" });
  const [isSkillDialogOpen, setSkillDialogOpen] = useState(false);

  const handleCreateAgent = async () => {
    try {
      const { error } = await supabase.from("subagents").insert({ user_id: user?.id, ...newAgent });
      if (error) throw error;
      toast.success("Subagente criado com sucesso!");
      setAgentDialogOpen(false);
      setNewAgent({ name: "", role: "", system_prompt: "", preferred_model: "google/gemini-2.5-flash-lite" });
      queryClient.invalidateQueries({ queryKey: ["subagents", user?.id] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro interno"); }
  };

  const handleCreateSkill = async () => {
    try {
      const { error } = await supabase.from("agent_skills").insert({ user_id: user?.id, ...newSkill });
      if (error) throw error;
      toast.success("Skill criada com sucesso!");
      setSkillDialogOpen(false);
      setNewSkill({ name: "", description: "", trigger_word: "", content: "" });
      queryClient.invalidateQueries({ queryKey: ["agent_skills", user?.id] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro interno"); }
  };

  const handleDeleteAgent = async (id: string) => {
    try {
      const { error } = await supabase.from("subagents").delete().eq("id", id);
      if (error) throw error;
      toast.success("Subagente removido");
      queryClient.invalidateQueries({ queryKey: ["subagents", user?.id] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro interno"); }
  };

  const handleDeleteSkill = async (id: string) => {
    try {
      const { error } = await supabase.from("agent_skills").delete().eq("id", id);
      if (error) throw error;
      toast.success("Skill removida");
      queryClient.invalidateQueries({ queryKey: ["agent_skills", user?.id] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro interno"); }
  };

  // Auto-switch to production if syncing
  useEffect(() => {
    if (isSyncing) setActiveTab("production");
  }, [isSyncing]);

  return (
    <div className="min-h-screen bg-[#070708] text-white flex flex-col font-sans selection:bg-primary/30">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-30 select-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />
      </div>

      <header className="sticky top-0 z-30 bg-[#070708]/80 backdrop-blur-xl border-b border-white/5">
        <div className="container flex h-16 items-center gap-4 px-4 sm:px-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="hover:bg-white/5 rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Factory className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="font-black text-xl italic tracking-tighter uppercase leading-none">AIOS Factory Line</h1>
                <p className="text-[10px] text-muted-foreground font-mono tracking-widest uppercase">Autonomous Industrial OS</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                className="hidden sm:flex gap-2 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all text-xs font-bold"
                onClick={() => navigate("/virtual-office")}
              >
                <Building className="h-4 w-4" />
                ESCRITÓRIO VIRTUAL
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-8 px-4 sm:px-8 flex-1 relative z-10 flex flex-col">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
          <div className="space-y-1">
            <h2 className="text-3xl font-black italic tracking-tighter">ESTEIRA DE PRODUÇÃO</h2>
            <p className="text-muted-foreground max-w-xl text-sm font-medium">
              A arquitetura determinística para clonagem de especialistas. Transformando dados brutos em DNA sintético de alta fidelidade.
            </p>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="shrink-0 bg-white/5 p-1 rounded-2xl border border-white/5">
            <TabsList className="bg-transparent border-0 gap-1 h-auto">
              <TabsTrigger value="production" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white font-bold text-xs uppercase tracking-wider transition-all">
                <Activity className="h-3.5 w-3.5 mr-2" /> Live Line
              </TabsTrigger>
              <TabsTrigger value="subagents" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white font-bold text-xs uppercase tracking-wider transition-all">
                <Bot className="h-3.5 w-3.5 mr-2" /> Assets
              </TabsTrigger>
              <TabsTrigger value="skills" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white font-bold text-xs uppercase tracking-wider transition-all">
                <Wrench className="h-3.5 w-3.5 mr-2" /> Playbooks
              </TabsTrigger>
              <TabsTrigger value="security" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-red-500 data-[state=active]:text-white font-bold text-xs uppercase tracking-wider transition-all">
                <Shield className="h-3.5 w-3.5 mr-2" /> Segurança
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <TabsContent value="production" className="flex-1 flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Industrial Factory Visualization */}
          <div className="relative p-12 bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden min-h-[400px] flex flex-col justify-center">
             {/* Progress Line */}
             <div className="absolute top-1/2 left-0 w-full h-[2px] bg-white/5 -translate-y-1/2" />
             <div 
               className="absolute top-1/2 left-0 h-[3px] bg-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)] -translate-y-1/2 transition-all duration-700 ease-out z-10"
               style={{ width: `${progress}%` }}
             />

             <div className="flex justify-between items-center relative z-20 w-full max-w-4xl mx-auto">
               {SQUAD_STATIONS.map((station, idx) => {
                 const isActive = currentAgent === station.id || (idx === 0 && isSyncing && !currentAgent);
                 const isDone = progress > ((idx + 1) / SQUAD_STATIONS.length) * 100 || (progress === 100);
                 const StationIcon = station.icon;

                 return (
                   <div key={station.id} className="flex flex-col items-center gap-4 relative group">
                      <div className={cn(
                        "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 border-2",
                        isActive ? "bg-primary/20 border-primary scale-110 shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] animate-pulse" : 
                        isDone ? "bg-primary/10 border-primary/50" : 
                        "bg-white/5 border-white/5 opacity-40"
                      )}>
                        <StationIcon className={cn("h-7 w-7 transition-colors", isActive ? "text-primary" : isDone ? "text-primary/70" : "text-white/20")} />
                        
                        {isActive && (
                          <div className="absolute -top-1 -right-1 flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-primary"></span>
                          </div>
                        )}
                        {isDone && !isActive && (
                          <CheckCircle2 className="absolute -bottom-1 -right-1 h-5 w-5 text-primary fill-[#070708]" />
                        )}
                      </div>
                      <div className="flex flex-col items-center text-center max-w-[100px]">
                        <span className={cn("text-[10px] font-black italic tracking-tighter uppercase mb-1", isActive ? "text-primary" : isDone ? "text-white" : "text-white/20")}>
                          STATION {idx + 1}
                        </span>
                        <span className={cn("text-[9px] font-mono uppercase tracking-widest", isActive ? "text-primary/70" : "text-muted-foreground/30")}>
                          {station.name}
                        </span>
                      </div>
                   </div>
                 );
               })}
             </div>

             {/* Dynamic Status Text */}
             <div className="mt-20 text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/5">
                   {isSyncing ? <Loader2 className="h-3 w-3 animate-spin text-primary" /> : <CheckCircle2 className="h-3 w-3 text-primary" />}
                   <span className="text-[10px] font-mono uppercase tracking-[0.2em] font-bold">
                     {isSyncing ? `PRODUZINDO CLONE... ${Math.round(progress)}%` : "FÁBRICA EM STANDBY"}
                   </span>
                </div>
                <h3 className="text-2xl font-black italic tracking-tighter h-8">
                  {message || "Aguardando próxima ordem de serviço..."}
                </h3>
             </div>
          </div>

          {/* Telemetry Terminal */}
          <Card className="bg-[#0b0b0c] border-white/5 shadow-2xl relative overflow-hidden flex-1 min-h-[300px]">
            <div className="absolute inset-0 bg-grid-white/[0.01] pointer-events-none" />
            <div className="bg-white/5 px-6 py-2 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-black tracking-widest uppercase italic">Produção Telemetry.log</span>
              </div>
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500/20" />
                <div className="w-2 h-2 rounded-full bg-yellow-500/20" />
                <div className="w-2 h-2 rounded-full bg-green-500/20" />
              </div>
            </div>
            <CardContent className="p-0 h-[400px]">
              <ScrollArea className="h-full font-mono text-[11px] p-6 text-primary/70 leading-relaxed">
                {logs.length === 0 ? (
                  <p className="text-white/10 italic">Nenhum evento registrado no fluxo atual.</p>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="mb-1 animate-in fade-in duration-300">
                      <span className="text-white/20 mr-3">[{new Date().toLocaleTimeString()}]</span>
                      <span className={cn(log.includes("CONCLUÍDA") ? "text-green-500" : "text-primary/70")}>{log}</span>
                    </div>
                  ))
                )}
                {isSyncing && (
                   <div className="flex items-center gap-2 mt-2 text-primary">
                     <span className="animate-pulse">_</span>
                     <span className="text-[10px] lowercase italic opacity-50">processando via Squad-7-Core...</span>
                   </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subagents" className="space-y-6 animate-in fade-in duration-500">
          <div className="flex justify-between items-center mb-6 bg-white/5 p-6 rounded-3xl border border-white/5">
             <div>
                <h2 className="text-2xl font-black italic tracking-tighter">MEUS ATIVOS</h2>
                <p className="text-muted-foreground text-xs font-medium">As unidades cognitivas prontas para implantação.</p>
             </div>
             <Dialog open={isAgentDialogOpen} onOpenChange={setAgentDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 rounded-xl px-6 font-bold tracking-tight bg-primary text-white hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95">
                    <Plus className="h-4 w-4" /> CONTRATAR AGENTE
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] bg-[#0c0c0d] border-white/10 text-white rounded-3xl">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-black italic">CONTRATAR ESPECIALISTA</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Identidade do Agente</Label>
                      <Input 
                        value={newAgent.name} 
                        onChange={e => setNewAgent({...newAgent, name: e.target.value})} 
                        placeholder="Ex: Arquiteto de Software" 
                        className="bg-white/5 border-white/10 rounded-xl focus:border-primary/50"
                      />
                    </div>
                    <div className="grid gap-2">
                       <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Arquétipo / Função</Label>
                      <Input 
                        value={newAgent.role} 
                        onChange={e => setNewAgent({...newAgent, role: e.target.value})} 
                        placeholder="Ex: Estrategista e Revisor de Segurança" 
                        className="bg-white/5 border-white/10 rounded-xl focus:border-primary/50"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Núcleo de Processamento (Modelo)</Label>
                      <Select value={newAgent.preferred_model} onValueChange={(val) => setNewAgent({...newAgent, preferred_model: val})}>
                        <SelectTrigger className="bg-white/5 border-white/10 rounded-xl">
                          <SelectValue placeholder="Selecione um modelo" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0c0c0d] border-white/10 text-white">
                          <SelectItem value="google/gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Rápido/Planejamento)</SelectItem>
                          <SelectItem value="meta-llama/llama-3.3-70b-instruct:free">Llama 3.3 70B (Programação/Análise Pesada)</SelectItem>
                          <SelectItem value="qwen/qwen3.6-plus:free">Qwen 3.6 Plus (Raciocínio Complexo Multilíngue)</SelectItem>
                          <SelectItem value="minimax/minimax-m2.5:free">Minimax m2.5 (Escrita Criativa/RP Longo)</SelectItem>
                          <SelectItem value="sourceful/riverflow-v2-fast">Riverflow v2 Fast (Roteamento Rápido)</SelectItem>
                          <SelectItem value="stepfun/step-3.5-flash:fre">Step 3.5 Flash (Resumos Rápidos)</SelectItem>
                          <SelectItem value="arcee-ai/trinity-large-preview:free">Trinity Large Preview (RAG e Leitura Profunda)</SelectItem>
                          <SelectItem value="liquid/lfm-2.5-1.2b-thinking:free">Liquid Thinking (Cadeia de Raciocínio Base)</SelectItem>
                          <SelectItem value="google/gemma-3-4b-it:free">Gemma 3 4B (Instruções Diretas/Simples)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Prompt de Sistema (DNA)</Label>
                      <Textarea 
                        rows={5}
                        className="bg-white/5 border-white/10 rounded-xl focus:border-primary/50"
                        value={newAgent.system_prompt} 
                        onChange={e => setNewAgent({...newAgent, system_prompt: e.target.value})} 
                        placeholder="Defina o comportamento e restrições rigorosas..." 
                      />
                    </div>
                  </div>
                  <Button onClick={handleCreateAgent} className="w-full rounded-2xl bg-primary hover:bg-primary/90 font-bold h-12">FORJAR AGENTE</Button>
                </DialogContent>
             </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {loadingAgents ? (
              [1,2,3].map(i => <div key={i} className="h-48 bg-white/5 rounded-3xl animate-pulse" />)
            ) : subagents?.length === 0 ? (
              <div className="col-span-full py-20 text-center text-muted-foreground border-2 border-dashed border-white/10 rounded-3xl">
                Nenhuma unidade montada na sua fábrica ainda.
              </div>
            ) : subagents?.map(agent => (
              <Card key={agent.id} className="relative group overflow-hidden bg-white/[0.02] border-white/5 hover:border-primary/30 transition-all duration-500 rounded-3xl">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="p-2.5 bg-primary/10 rounded-xl group-hover:scale-110 transition-transform duration-500">
                      <Bot className="h-6 w-6 text-primary" />
                    </div>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-xl opacity-0 group-hover:opacity-100 transition-all" onClick={() => handleDeleteAgent(agent.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardTitle className="mt-3 text-lg font-black italic tracking-tighter uppercase leading-none group-hover:text-primary transition-colors">{agent.name}</CardTitle>
                  <CardDescription className="text-[10px] font-mono tracking-widest uppercase">{agent.role}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-[9px] bg-white/5 p-2 rounded-lg font-mono text-muted-foreground border border-white/5 inline-block">
                    {agent.preferred_model.split('/')[1] || agent.preferred_model}
                  </div>
                  <p className="text-[11px] text-muted-foreground/80 line-clamp-3 leading-relaxed italic">
                    "{agent.system_prompt}"
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="skills" className="space-y-6 animate-in fade-in duration-500">
          {/* Similar high-fidelity treatment for skills section */}
          <div className="flex justify-between items-center mb-6 bg-white/5 p-6 rounded-3xl border border-white/5">
             <div>
                <h2 className="text-2xl font-black italic tracking-tighter leading-none">BIBLIOTECA DE PLAYBOOKS</h2>
                <p className="text-muted-foreground text-xs font-medium">Workflows determinísticos que guiam as unidades.</p>
             </div>
             <Dialog open={isSkillDialogOpen} onOpenChange={setSkillDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 rounded-xl px-6 font-bold tracking-tight bg-primary text-white hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95">
                    <Plus className="h-4 w-4" /> NOVO PLAYBOOK
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] bg-[#0c0c0d] border-white/10 text-white rounded-3xl">
                   <DialogHeader><DialogTitle className="text-2xl font-black italic">DEVELOPER PLAYBOOK</DialogTitle></DialogHeader>
                   <ScrollArea className="max-h-[60vh] pr-4 py-4">
                      <div className="grid gap-4">
                        <div className="grid gap-2">
                          <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Nome do Workflow</Label>
                          <Input value={newSkill.name} onChange={e => setNewSkill({...newSkill, name: e.target.value})} className="bg-white/5 border-white/10 rounded-xl" />
                        </div>
                        <div className="grid gap-2">
                          <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Gatilho (Trigger)</Label>
                          <Input value={newSkill.trigger_word} onChange={e => setNewSkill({...newSkill, trigger_word: e.target.value})} placeholder="@analisar" className="bg-white/5 border-white/10 rounded-xl" />
                        </div>
                        <div className="grid gap-2">
                          <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Instruções Operacionais (Markdown)</Label>
                          <Textarea rows={8} value={newSkill.content} onChange={e => setNewSkill({...newSkill, content: e.target.value})} className="bg-white/5 border-white/10 rounded-xl" placeholder="Passo 1: ...\nPasso 2: ..." />
                        </div>
                      </div>
                   </ScrollArea>
                   <Button onClick={handleCreateSkill} className="w-full rounded-2xl bg-primary hover:bg-primary/90 font-bold h-12">GRAVAR SKILL</Button>
                </DialogContent>
             </Dialog>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {loadingSkills ? (
               [1,2].map(i => <div key={i} className="h-56 bg-white/5 rounded-3xl animate-pulse" />)
            ) : skills?.length === 0 ? (
               <div className="col-span-full py-20 text-center text-muted-foreground border-2 border-dashed border-white/10 rounded-3xl">Nenhuma skill gravada.</div>
            ) : skills?.map(skill => (
              <Card key={skill.id} className="relative group bg-[#0d0d0e] border-white/5 hover:border-primary/20 transition-all duration-500 rounded-3xl p-6">
                 <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4">
                       <div className="p-3 bg-primary/10 rounded-2xl"><Cog className="h-6 w-6 text-primary" /></div>
                       <div>
                          <h3 className="font-black italic tracking-tighter uppercase text-lg leading-none">{skill.name}</h3>
                          <span className="text-[10px] font-mono text-primary font-bold">{skill.trigger_word}</span>
                       </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-500 rounded-xl opacity-0 group-hover:opacity-100 transition-all" onClick={() => handleDeleteSkill(skill.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                 </div>
                 <p className="text-xs text-muted-foreground mb-4 font-medium italic">"{skill.description}"</p>
                 <div className="bg-white/[0.03] border border-white/5 p-4 rounded-xl text-[10px] font-mono leading-relaxed h-32 overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0e] to-transparent pointer-events-none" />
                    {skill.content}
                 </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-6 animate-in fade-in duration-500">
          <SecurityDashboard />
        </TabsContent>
      </main>
    </div>
  );
}
