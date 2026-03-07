import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BRAIN_TYPE_CONFIG, BrainType } from "@/lib/brain-types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import ChatInterface from "@/components/ChatInterface";
import AgentSquadView from "@/components/AgentSquadView";
import { useGeneralChat } from "@/hooks/useGeneralChat";
import { useAgentSquad } from "@/hooks/useAgentSquad";
import { useCloneSummon } from "@/hooks/useCloneSummon";
import {
  ArrowLeft,
  Bot,
  Brain,
  MessageSquare,
  PlusCircle,
  Users,
  ChevronRight,
  Menu,
  PanelLeftClose,
  PanelLeft,
  Send,
  Square,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

export default function GeneralChat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [agentMode, setAgentMode] = useState(false);
  const [agentInput, setAgentInput] = useState("");
  const [activeBrainType, setActiveBrainType] =
    useState<BrainType>("knowledge_base");

  const {
    messages,
    isStreaming,
    activeBrainId,
    activeBrainName,
    setActiveBrainId,
    setActiveBrainName,
    sendMessage,
    stopStreaming,
    resetChat,
  } = useGeneralChat();

  const {
    events: squadEvents,
    isRunning: squadRunning,
    finalAnswer,
    synthesisSoFar,
    runSquad,
    reset: resetSquad,
    stop: stopSquad,
  } = useAgentSquad();

  const {
    summonedMessages,
    isSummoning,
    executeSummon,
    resetSummoned,
    updateProfile,
  } = useCloneSummon();

  const { data: brains, isLoading } = useQuery({
    queryKey: ["brains", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brains")
        .select("id, name, type, description")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Also sync activeBrainType on first auto-select
  useEffect(() => {
    if (brains && brains.length > 0 && !activeBrainId) {
      setActiveBrainId(brains[0].id);
      setActiveBrainName(brains[0].name);
      setActiveBrainType(brains[0].type as BrainType);
    }
  }, [brains, activeBrainId, setActiveBrainId, setActiveBrainName]);

  const handleSelectBrain = (brain: {
    id: string;
    name: string;
    type: string;
  }) => {
    setActiveBrainId(brain.id);
    setActiveBrainName(brain.name);
    setActiveBrainType(brain.type as BrainType);
    resetChat();
    resetSummoned();
    if (isMobile) setMobileSidebarOpen(false);
    toast.success(`Clone "${brain.name}" selecionado`);
  };

  const handleSummonClone = (targetBrainId: string, reason: string) => {
    executeSummon({ targetBrainId, reason }, messages);
  };

  // Auto-update user profile after each assistant response (non-blocking)
  useEffect(() => {
    if (
      messages.length > 0 &&
      messages.at(-1)?.role === "assistant" &&
      !isStreaming
    ) {
      updateProfile(messages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, isStreaming]);

  const handleAgentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentInput.trim() || squadRunning) return;
    const brainIds = brains?.map((b) => b.id);
    runSquad(agentInput.trim(), brainIds);
    setAgentInput("");
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Sidebar header */}
      <div className="p-3 border-b border-border/50">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 px-1 mb-2">
          Clones Disponíveis
        </p>
        {isLoading ? (
          <div className="space-y-2 px-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-10 rounded-xl bg-muted/50 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <ScrollArea className="max-h-[35vh]">
            <div className="space-y-0.5 pr-1">
              {brains?.map((brain) => {
                const config = BRAIN_TYPE_CONFIG[brain.type as BrainType];
                const Icon = config?.icon || Brain;
                const isActive = activeBrainId === brain.id;
                return (
                  <button
                    key={brain.id}
                    onClick={() => handleSelectBrain(brain)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all text-sm ${
                      isActive
                        ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                        : "text-foreground/80 hover:bg-muted/60"
                    }`}
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                        isActive ? "bg-primary/20" : "bg-muted"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">
                        {brain.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground opacity-70 truncate">
                        {config?.label || brain.type}
                      </p>
                    </div>
                    {isActive && <ChevronRight className="h-3 w-3 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Mode section */}
      <div className="p-3 border-b border-border/50">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 px-1 mb-2">
          Modo de Chat
        </p>
        <div className="space-y-1">
          <button
            onClick={() => setAgentMode(false)}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              !agentMode
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-foreground/70 hover:bg-muted/60"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Chat com Clone
          </button>
          <button
            onClick={() => setAgentMode(true)}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              agentMode
                ? "bg-gradient-to-r from-primary/15 to-accent/10 text-primary border border-primary/20"
                : "text-foreground/70 hover:bg-muted/60"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Modo Agente (Squad)
            <Badge
              variant="outline"
              className="ml-auto text-[9px] px-1.5 py-0 h-4 border-primary/30 text-primary"
            >
              Beta
            </Badge>
          </button>
        </div>
      </div>

      {/* New chat */}
      <div className="p-3">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 rounded-xl h-9 border-dashed border-primary/30 hover:border-primary/60 text-primary text-xs font-semibold"
          onClick={() => {
            resetChat();
            resetSquad();
          }}
        >
          <PlusCircle className="h-3.5 w-3.5" />
          Nova Conversa
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      {!isMobile && sidebarOpen && (
        <div className="w-64 border-r border-border/50 bg-sidebar-background flex flex-col shrink-0 animate-in slide-in-from-left duration-200">
          {sidebarContent}
        </div>
      )}

      {/* Mobile Sidebar */}
      <Sheet
        open={mobileSidebarOpen && !!isMobile}
        onOpenChange={setMobileSidebarOpen}
      >
        <SheetContent
          side="left"
          className="p-0 w-[280px] bg-sidebar-background"
        >
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="flex h-12 items-center gap-2 px-3">
            {isMobile ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileSidebarOpen(true)}
                className="rounded-lg h-8 w-8"
              >
                <Menu className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="rounded-lg h-8 w-8"
              >
                {sidebarOpen ? (
                  <PanelLeftClose className="h-4 w-4" />
                ) : (
                  <PanelLeft className="h-4 w-4" />
                )}
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="rounded-lg h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="min-w-0 mr-auto">
              <div className="flex items-center gap-2">
                {agentMode ? (
                  <Users className="h-4 w-4 text-primary" />
                ) : (
                  <Bot className="h-4 w-4 text-primary" />
                )}
                <h1 className="font-bold text-sm truncate leading-tight">
                  {agentMode
                    ? "Modo Agente — Squad"
                    : `Chat com ${activeBrainName}`}
                </h1>
                {agentMode && (
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1.5 h-4 border-primary/30 text-primary"
                  >
                    {brains?.length || 0} clones disponíveis
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        {agentMode ? (
          <div className="flex flex-col flex-1 min-h-0">
            {squadEvents.length === 0 && !squadRunning ? (
              /* Empty state for squad */
              <div className="flex flex-col items-center justify-center flex-1 text-center px-4 space-y-6 animate-in fade-in duration-700">
                <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center border border-primary/20">
                  <Users className="h-10 w-10 text-primary" />
                </div>
                <div className="space-y-2">
                  <p className="text-2xl font-bold">Modo Agente</p>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    O Agente Administrador selecionará automaticamente os clones
                    mais relevantes, eles debaterão entre si e você receberá a
                    melhor resposta possível.
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap justify-center text-xs text-muted-foreground">
                  {brains?.slice(0, 4).map((b) => (
                    <Badge key={b.id} variant="outline" className="text-[10px]">
                      {b.name}
                    </Badge>
                  ))}
                  {(brains?.length || 0) > 4 && (
                    <Badge variant="outline" className="text-[10px]">
                      +{(brains?.length || 0) - 4} mais
                    </Badge>
                  )}
                </div>
              </div>
            ) : (
              <AgentSquadView
                events={squadEvents}
                isRunning={squadRunning}
                finalAnswer={finalAnswer}
                synthesisSoFar={synthesisSoFar}
                stop={stopSquad}
                onReset={resetSquad}
              />
            )}

            {/* Squad input */}
            {!squadRunning && !finalAnswer && (
              <div className="border-t border-border/40 bg-card/60 backdrop-blur-xl px-3 sm:px-4 py-3 pb-5 sm:pb-3">
                <form
                  onSubmit={handleAgentSubmit}
                  className="max-w-3xl mx-auto flex items-end gap-2 sm:gap-3"
                >
                  <div className="relative flex-1 bg-background/80 border border-border/60 rounded-2xl sm:rounded-3xl shadow-inner focus-within:border-primary/50 transition-all duration-300">
                    <textarea
                      value={agentInput}
                      onChange={(e) => setAgentInput(e.target.value)}
                      onKeyDown={(
                        e: React.KeyboardEvent<HTMLTextAreaElement>,
                      ) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (!agentInput.trim() || squadRunning) return;
                          const brainIds = brains?.map((b) => b.id);
                          runSquad(agentInput.trim(), brainIds);
                          setAgentInput("");
                        }
                      }}
                      placeholder="Faça uma pergunta ao squad... (Enter para enviar)"
                      rows={1}
                      className="w-full resize-none bg-transparent text-sm px-4 py-3.5 pr-2 outline-none text-foreground placeholder:text-muted-foreground"
                      style={{ height: "auto", minHeight: "52px" }}
                    />
                  </div>
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!agentInput.trim() || squadRunning}
                    className="h-11 w-11 rounded-2xl shrink-0 bg-gradient-to-br from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 shadow-lg shadow-primary/30 transition-all active:scale-95 disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
                <p className="text-[10px] text-muted-foreground/60 text-center mt-2">
                  Shift+Enter para nova linha
                </p>
              </div>
            )}

            {/* Squad running - show stop button in input area */}
            {squadRunning && (
              <div className="border-t border-border/40 bg-card/60 backdrop-blur-xl px-3 sm:px-4 py-3">
                <div className="max-w-3xl mx-auto flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={stopSquad}
                    className="gap-2 rounded-xl border-destructive/40 hover:bg-destructive/10 text-destructive"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                    Parar Squad
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : /* Normal chat interface */
        activeBrainId ? (
          <ChatInterface
            brainId={activeBrainId}
            brainType={activeBrainType}
            brainName={activeBrainName}
            messages={messages}
            isStreaming={isStreaming}
            sendMessage={sendMessage}
            stopStreaming={stopStreaming}
            onNewChat={resetChat}
            conversationId={null}
            showModeToggle={true}
            summonedMessages={summonedMessages}
            isSummoning={isSummoning}
            onSummonClone={handleSummonClone}
          />
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 text-center px-4 space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
              <Bot className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-bold">Selecione um Clone</p>
            <p className="text-sm text-muted-foreground">
              Escolha um clone na sidebar para começar a conversar.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
