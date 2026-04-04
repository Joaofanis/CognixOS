import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ArrowLeft, Bot, Cog, Plus, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AIOS() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("subagents");

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

  // New subagent state
  const [newAgent, setNewAgent] = useState({ name: "", role: "", system_prompt: "", preferred_model: "google/gemini-2.5-flash-lite" });
  const [isAgentDialogOpen, setAgentDialogOpen] = useState(false);

  // New skill state
  const [newSkill, setNewSkill] = useState({ name: "", description: "", trigger_word: "", content: "" });
  const [isSkillDialogOpen, setSkillDialogOpen] = useState(false);

  // Create Subagent
  const handleCreateAgent = async () => {
    try {
      const { error } = await supabase.from("subagents").insert({
        user_id: user?.id,
        ...newAgent
      });
      if (error) throw error;
      toast.success("Subagente criado com sucesso!");
      setAgentDialogOpen(false);
      setNewAgent({ name: "", role: "", system_prompt: "", preferred_model: "google/gemini-2.5-flash-lite" });
      queryClient.invalidateQueries({ queryKey: ["subagents", user?.id] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Create Skill
  const handleCreateSkill = async () => {
    try {
      const { error } = await supabase.from("agent_skills").insert({
        user_id: user?.id,
        ...newSkill
      });
      if (error) throw error;
      toast.success("Skill criada com sucesso!");
      setSkillDialogOpen(false);
      setNewSkill({ name: "", description: "", trigger_word: "", content: "" });
      queryClient.invalidateQueries({ queryKey: ["agent_skills", user?.id] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Delete Handlers
  const handleDeleteAgent = async (id: string) => {
    try {
      const { error } = await supabase.from("subagents").delete().eq("id", id);
      if (error) throw error;
      toast.success("Subagente removido");
      queryClient.invalidateQueries({ queryKey: ["subagents", user?.id] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeleteSkill = async (id: string) => {
    try {
      const { error } = await supabase.from("agent_skills").delete().eq("id", id);
      if (error) throw error;
      toast.success("Skill removida");
      queryClient.invalidateQueries({ queryKey: ["agent_skills", user?.id] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-mesh bg-background flex flex-col">
      <header className="sticky top-0 z-20 glass border-b border-border/50">
        <div className="container flex h-16 items-center gap-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <h1 className="font-bold text-lg">AIOS Factory Line</h1>
            </div>
            <Button 
              variant="outline" 
              className="gap-2 rounded-xl border-primary/30 bg-primary/5 hover:bg-primary/10"
              onClick={() => navigate("/virtual-office")}
            >
              <Building className="h-4 w-4" />
              Escritório Virtual (Beta)
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl py-8 px-4 flex-1">
        <p className="text-muted-foreground mb-8 max-w-2xl">
          Construa a sua linha de montagem determinística. Crie Subagentes com propósitos únicos e Skills que atuam como Manuais de Operação rigorosos (Playbooks) para automações perfeitas.
        </p>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full md:w-[400px] grid-cols-2 mb-8">
            <TabsTrigger value="subagents" className="gap-2"><Bot className="h-4 w-4" /> Subagentes</TabsTrigger>
            <TabsTrigger value="skills" className="gap-2"><Wrench className="h-4 w-4" /> Skills</TabsTrigger>
          </TabsList>

          <TabsContent value="subagents" className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Gerenciar Subagentes</h2>
              <Dialog open={isAgentDialogOpen} onOpenChange={setAgentDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2"><Plus className="h-4 w-4" /> Novo Agente</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Criar Subagente Especializado</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Nome do Agente (Ex: Code Reviewer)</Label>
                      <Input value={newAgent.name} onChange={e => setNewAgent({...newAgent, name: e.target.value})} placeholder="Nome" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Role / Função (Ex: Revisor e Crítico de Segurança)</Label>
                      <Input value={newAgent.role} onChange={e => setNewAgent({...newAgent, role: e.target.value})} placeholder="Escreva a função resumo" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Modelo Recomendado (Velocidade vs Qualidade)</Label>
                      <Select value={newAgent.preferred_model} onValueChange={(val) => setNewAgent({...newAgent, preferred_model: val})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um modelo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="google/gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Rápido/Barato/Peão)</SelectItem>
                          <SelectItem value="liquid/lfm-2.5-1.2b-thinking:free">Liquid LFM Thinking (Reflexão e Raciocínio)</SelectItem>
                          <SelectItem value="google/gemini-2.0-flash-001">Gemini 2.0 Flash (Arquiteto/Revisor Geral)</SelectItem>
                          <SelectItem value="nvidia/nemotron-3-super-120b-a12b:free">Nemotron 3 Super (Análise Complexa)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Prompt do Sistema (DNA do Subagente)</Label>
                      <Textarea 
                        rows={5}
                        value={newAgent.system_prompt} 
                        onChange={e => setNewAgent({...newAgent, system_prompt: e.target.value})} 
                        placeholder="Você é um revisor de código estrito. Sua única função é receber o código e retornar apenas os problemas de segurança..." 
                      />
                    </div>
                  </div>
                  <Button onClick={handleCreateAgent}>Salvar Subagente</Button>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loadingAgents ? <p>Carregando...</p> : subagents?.length === 0 ? (
                <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                  Nenhum subagente montado na sua fábrica ainda.
                </div>
              ) : subagents?.map(agent => (
                <Card key={agent.id} className="relative group overflow-hidden border-primary/20 hover:border-primary/50 transition-all">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                  <CardHeader className="pb-2 relative">
                    <div className="flex justify-between items-start">
                      <div className="p-2 bg-primary/10 rounded-lg"><Bot className="h-5 w-5 text-primary" /></div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteAgent(agent.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <CardTitle className="mt-2">{agent.name}</CardTitle>
                    <CardDescription>{agent.role}</CardDescription>
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="text-xs bg-muted p-2 rounded-md truncate font-mono text-muted-foreground mb-2">
                      {agent.preferred_model.split('/')[1] || agent.preferred_model}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-3">{agent.system_prompt}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="skills" className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Banco de Skills (Playbooks)</h2>
              <Dialog open={isSkillDialogOpen} onOpenChange={setSkillDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2"><Plus className="h-4 w-4" /> Nova Skill</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>Criar Playbook / Skill</DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="max-h-[60vh] pr-4">
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label>Nome da Skill</Label>
                        <Input value={newSkill.name} onChange={e => setNewSkill({...newSkill, name: e.target.value})} placeholder="Ex: Criação de Postagem de Blog" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Descrição Curta</Label>
                        <Input value={newSkill.description} onChange={e => setNewSkill({...newSkill, description: e.target.value})} placeholder="Descreva brevemente o que isso faz" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Gatilho (Trigger Word)</Label>
                        <Input value={newSkill.trigger_word} onChange={e => setNewSkill({...newSkill, trigger_word: e.target.value})} placeholder="Ex: @blog ou !analisador" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Conteúdo (O Workflow Step-by-Step em Markdown)</Label>
                        <Textarea 
                          rows={8}
                          value={newSkill.content} 
                          onChange={e => setNewSkill({...newSkill, content: e.target.value})} 
                          placeholder="Passo 1: Extrair a estrutura base usando o agente X...\nPasso 2: Validar o tom usando o agente Y..." 
                        />
                      </div>
                    </div>
                  </ScrollArea>
                  <Button onClick={handleCreateSkill} className="mt-4 w-full">Gravar Skill</Button>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {loadingSkills ? <p>Carregando...</p> : skills?.length === 0 ? (
                <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                  Nenhuma skill/playbook definida.
                </div>
              ) : skills?.map(skill => (
                <Card key={skill.id} className="relative group border-accent/20 hover:border-accent/50 transition-all">
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent to-primary opacity-50" />
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-accent/10 rounded-lg"><Cog className="h-5 w-5 text-accent" /></div>
                        <div>
                          <CardTitle className="text-base">{skill.name}</CardTitle>
                          <span className="text-xs font-mono font-bold text-accent">{skill.trigger_word}</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteSkill(skill.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <CardDescription className="mt-2">{skill.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted rounded-md p-3 text-xs font-mono text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                      {skill.content}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
