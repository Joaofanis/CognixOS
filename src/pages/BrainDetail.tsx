import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BRAIN_TYPE_CONFIG, BrainType } from "@/lib/brain-types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, MessageSquare, FileText, BarChart3 } from "lucide-react";
import FeedTexts from "@/components/FeedTexts";
import ChatInterface from "@/components/ChatInterface";
import BrainAnalysis from "@/components/BrainAnalysis";

export default function BrainDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

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

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!brain) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Cérebro não encontrado</p>
      </div>
    );
  }

  const config = BRAIN_TYPE_CONFIG[brain.type as BrainType];
  const Icon = config?.icon;
  const isPersonClone = brain.type === "person_clone";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur-sm">
        <div className="container flex h-14 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          {Icon && <Icon className="h-5 w-5 text-primary" />}
          <div className="min-w-0">
            <h1 className="font-semibold truncate">{brain.name}</h1>
            <p className="text-xs text-muted-foreground">{config?.label}</p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <Tabs defaultValue="chat" className="flex-1 flex flex-col">
        <div className="border-b bg-card/50">
          <div className="container">
            <TabsList className="h-11 w-full justify-start bg-transparent p-0">
              <TabsTrigger value="chat" className="gap-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                <MessageSquare className="h-4 w-4" /> Chat
              </TabsTrigger>
              <TabsTrigger value="texts" className="gap-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                <FileText className="h-4 w-4" /> Textos
              </TabsTrigger>
              {isPersonClone && (
                <TabsTrigger value="analysis" className="gap-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                  <BarChart3 className="h-4 w-4" /> Análise
                </TabsTrigger>
              )}
            </TabsList>
          </div>
        </div>

        <TabsContent value="chat" className="flex-1 m-0">
          <ChatInterface brainId={brain.id} brainType={brain.type as BrainType} brainName={brain.name} />
        </TabsContent>
        <TabsContent value="texts" className="m-0">
          <FeedTexts brainId={brain.id} />
        </TabsContent>
        {isPersonClone && (
          <TabsContent value="analysis" className="m-0">
            <BrainAnalysis brainId={brain.id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
