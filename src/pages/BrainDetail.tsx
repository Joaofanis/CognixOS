import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BRAIN_TYPE_CONFIG, BrainType } from "@/lib/brain-types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  MessageSquare, 
  FileText, 
  BarChart3, 
  History, 
  Clock,
  ChevronRight,
  Brain as BrainIcon
} from "lucide-react";
import FeedTexts from "@/components/FeedTexts";
import ChatInterface from "@/components/ChatInterface";
import BrainAnalysis from "@/components/BrainAnalysis";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function BrainDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showHistory, setShowHistory] = useState(false);

  const { data: brain, isLoading } = useQuery({
    queryKey: ["brain", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brains")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: conversations } = useQuery({
    queryKey: ["conversations", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("brain_id", id!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <div className="animate-pulse text-muted-foreground font-medium">Sincronizando neurônios...</div>
        </div>
      </div>
    );
  }

  if (!brain) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-xl font-semibold">Cérebro não encontrado</p>
          <Button onClick={() => navigate("/")} variant="link">Voltar para Dashboard</Button>
        </div>
      </div>
    );
  }

  const config = BRAIN_TYPE_CONFIG[brain.type as BrainType];
  const Icon = config?.icon || BrainIcon;
  const isPersonClone = brain.type === "person_clone";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 glass border-b">
        <div className="container flex h-16 items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-full hover:bg-primary/10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10`}>
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 mr-auto">
            <h1 className="font-bold text-lg truncate leading-tight">{brain.name}</h1>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{config?.label}</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowHistory(!showHistory)}
            className={`hidden sm:flex gap-2 rounded-full transition-all ${showHistory ? 'bg-primary/10 border-primary text-primary' : ''}`}
          >
            <History className="h-4 w-4" />
            Histórico
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <Tabs defaultValue="chat" className="flex-1 flex flex-col">
        <div className="border-b bg-card/30 backdrop-blur-sm">
          <div className="container">
            <TabsList className="h-12 w-full justify-start bg-transparent p-0 gap-6">
              <TabsTrigger value="chat" className="gap-2 px-1 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none font-medium transition-all">
                <MessageSquare className="h-4 w-4" /> Chat
              </TabsTrigger>
              <TabsTrigger value="texts" className="gap-2 px-1 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none font-medium transition-all">
                <FileText className="h-4 w-4" /> Fonte de Dados
              </TabsTrigger>
              {isPersonClone && (
                <TabsTrigger value="analysis" className="gap-2 px-1 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none font-medium transition-all">
                  <BarChart3 className="h-4 w-4" /> Análise Psicológica
                </TabsTrigger>
              )}
            </TabsList>
          </div>
        </div>

        <TabsContent value="chat" className="flex-1 m-0 relative flex overflow-hidden">
          <div className="flex-1 flex flex-col">
            <ChatInterface brainId={brain.id} brainType={brain.type as BrainType} brainName={brain.name} />
          </div>
          
          {/* History Sidebar */}
          {showHistory && (
            <div className="hidden sm:flex flex-col w-72 border-l bg-card/30 backdrop-blur-sm animate-in slide-in-from-right duration-300">
              <div className="p-4 border-b flex items-center justify-between bg-card/50">
                <h3 className="font-semibold text-sm">Conversas Recentes</h3>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowHistory(false)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-2">
                  {conversations?.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground italic">
                      Nenhuma conversa ainda
                    </div>
                  ) : (
                    conversations?.map((conv) => (
                      <button
                        key={conv.id}
                        className="w-full text-left p-3 rounded-xl hover:bg-primary/5 border border-transparent hover:border-primary/10 transition-all group"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
                            {new Date(conv.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm font-medium line-clamp-2 truncate group-hover:text-primary transition-colors">
                          {conv.title || "Nova Conversa"}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </TabsContent>
        <TabsContent value="texts" className="m-0 bg-background/50 flex-1">
          <FeedTexts brainId={brain.id} />
        </TabsContent>
        {isPersonClone && (
          <TabsContent value="analysis" className="m-0 bg-background/50 flex-1">
            <BrainAnalysis brainId={brain.id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
