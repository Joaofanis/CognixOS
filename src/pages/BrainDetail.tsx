import { useState, useEffect, useRef } from "react";
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
  MoreVertical,
  Pencil,
  Trash2,
  PlusCircle,
  Brain as BrainIcon,
  Sparkles,
} from "lucide-react";
import FeedTexts from "@/components/FeedTexts";
import ChatInterface from "@/components/ChatInterface";
import BrainAnalysis from "@/components/BrainAnalysis";
import BrainPromptEditor from "@/components/BrainPromptEditor";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import EditBrainDialog from "@/components/EditBrainDialog";
import { useBrainChat } from "@/hooks/useBrainChat";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

export default function BrainDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isMobile = useIsMobile();

  const userResetRef = useRef(false);

  const {
    messages,
    isStreaming,
    sendMessage,
    stopStreaming,
    loadHistory,
    conversationId,
    resetChat,
    retry,
  } = useBrainChat({ brainId: id! });

  const handleNewChat = () => {
    userResetRef.current = true;
    resetChat();
  };

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

  useEffect(() => {
    // Auto-load last conversation only on initial mount — skip if user explicitly started a new chat
    if (
      !conversationId &&
      conversations &&
      conversations.length > 0 &&
      messages.length === 0
    ) {
      if (!userResetRef.current) {
        loadHistory(conversations[0].id);
      }
    }
  }, [conversations, conversationId, messages.length]);

  const handleDeleteBrain = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.from("brains").delete().eq("id", id!);
      if (error) throw error;
      toast.success("Cérebro deletado.");
      navigate("/");
      queryClient.invalidateQueries({ queryKey: ["brains"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
      setShowDelete(false);
    }
  };

  const handleDeleteConversation = async (
    e: React.MouseEvent,
    convId: string,
  ) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from("conversations")
        .delete()
        .eq("id", convId);
      if (error) throw error;
      toast.success("Conversa excluída.");
      if (conversationId === convId) {
        handleNewChat();
      }
      queryClient.invalidateQueries({ queryKey: ["conversations", id] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <div className="animate-pulse text-muted-foreground font-medium">
            Sincronizando neurônios...
          </div>
        </div>
      </div>
    );
  }

  if (!brain) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-xl font-semibold">Cérebro não encontrado</p>
          <Button onClick={() => navigate("/")} variant="link">
            Voltar para Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const config = BRAIN_TYPE_CONFIG[brain.type as BrainType];
  const Icon = config?.icon || BrainIcon;

  const renderHistoryContent = () => (
    <div className="flex-1 flex flex-col h-full bg-card/50 backdrop-blur-xl animate-in slide-in-from-right duration-300">
      <div className="px-4 py-3.5 border-b border-border/50 flex items-center justify-between">
        <h3 className="font-bold text-sm text-gradient">Conversas Recentes</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 hidden sm:flex rounded-xl hover:bg-muted"
          onClick={() => setShowHistory(false)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-3 border-b border-border/50">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 rounded-2xl h-10 border border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/8 transition-all text-primary font-semibold text-sm"
          onClick={() => {
            handleNewChat();
            setShowHistory(false);
          }}
        >
          <PlusCircle className="h-4 w-4" />
          Nova Conversa
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1.5">
          {conversations?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground/80 italic text-sm">
              Nenhuma conversa ainda
            </div>
          ) : (
            conversations?.map((conv) => (
              <div
                key={conv.id}
                onClick={() => {
                  userResetRef.current = false;
                  loadHistory(conv.id);
                  setShowHistory(false);
                }}
                className={`w-full text-left p-3 rounded-2xl transition-all group cursor-pointer border ${
                  conversationId === conv.id
                    ? "bg-primary/12 border-primary/30 shadow-sm"
                    : "hover:bg-primary/5 border-transparent hover:border-primary/15"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground font-semibold tracking-wide">
                      {new Date(conv.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/15 hover:text-destructive rounded-xl"
                    onClick={(e) => handleDeleteConversation(e, conv.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <p
                  className={`text-sm font-medium line-clamp-2 transition-colors ${
                    conversationId === conv.id
                      ? "text-primary"
                      : "group-hover:text-primary"
                  }`}
                >
                  {conv.title || "Nova Conversa"}
                </p>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-mesh bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 glass border-b border-border/50">
        <div className="container flex h-16 items-center gap-2 sm:gap-4 px-4 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="rounded-2xl hover:bg-primary/10 h-9 w-9"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/10 shadow-sm">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 mr-auto max-w-[130px] sm:max-w-none">
            <h1 className="font-extrabold text-base sm:text-lg truncate leading-tight text-gradient">
              {brain.name}
            </h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-widest">
              {config?.label}
            </p>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              className={`flex gap-1.5 rounded-2xl transition-all h-9 px-3 sm:px-4 font-medium text-xs sm:text-sm ${
                showHistory
                  ? "bg-primary/15 border-primary/50 text-primary shadow-inner"
                  : "hover:bg-primary/10 hover:border-primary/30"
              }`}
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Histórico</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-2xl h-9 w-9 hover:bg-muted/80"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-44 glass rounded-2xl"
              >
                <DropdownMenuItem
                  onClick={() => setShowEdit(true)}
                  className="gap-2 cursor-pointer rounded-xl m-1"
                >
                  <Pencil className="h-4 w-4" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowDelete(true)}
                  className="gap-2 cursor-pointer text-destructive focus:text-destructive rounded-xl m-1"
                >
                  <Trash2 className="h-4 w-4" /> Excluir Cérebro
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <Tabs defaultValue="chat" className="flex-1 flex flex-col">
        <div className="border-b border-border/40 bg-card/40 backdrop-blur-xl">
          <div className="container">
            <TabsList className="h-12 w-full justify-start bg-transparent p-0 gap-6">
              <TabsTrigger
                value="chat"
                className="gap-2 px-1 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none font-semibold transition-all text-sm text-muted-foreground"
              >
                <MessageSquare className="h-4 w-4" /> Chat
              </TabsTrigger>
              <TabsTrigger
                value="texts"
                className="gap-2 px-1 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none font-semibold transition-all text-sm text-muted-foreground"
              >
                <FileText className="h-4 w-4" /> Fontes
              </TabsTrigger>
              <TabsTrigger
                value="analysis"
                className="gap-2 px-1 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none font-semibold transition-all text-sm text-muted-foreground"
              >
                <BarChart3 className="h-4 w-4" /> Análise
              </TabsTrigger>
              <TabsTrigger
                value="prompt"
                className="gap-2 px-1 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none font-semibold transition-all text-sm text-muted-foreground"
              >
                <Sparkles className="h-4 w-4" /> Prompt
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent
          value="chat"
          className="flex-1 m-0 relative flex overflow-hidden"
        >
          <div className="flex-1 flex flex-col">
            <ChatInterface
              brainId={brain.id}
              brainType={brain.type as BrainType}
              brainName={brain.name}
              messages={messages}
              isStreaming={isStreaming}
              sendMessage={sendMessage}
              stopStreaming={stopStreaming}
              onNewChat={handleNewChat}
              conversationId={conversationId}
              onRetry={retry}
            />
          </div>

          {showHistory && (
            <div className="hidden sm:flex flex-col w-72 border-l">
              {renderHistoryContent()}
            </div>
          )}

          <Sheet open={showHistory && isMobile} onOpenChange={setShowHistory}>
            <SheetContent side="right" className="p-0 w-[85%] sm:hidden glass">
              {renderHistoryContent()}
            </SheetContent>
          </Sheet>
        </TabsContent>
        <TabsContent value="texts" className="m-0 bg-background/50 flex-1">
          <FeedTexts brainId={brain.id} />
        </TabsContent>
        <TabsContent value="analysis" className="m-0 bg-background/50 flex-1">
          <BrainAnalysis
            brainId={brain.id}
            brainType={brain.type as BrainType}
          />
        </TabsContent>
        <TabsContent value="prompt" className="m-0 bg-background/50 flex-1">
          <BrainPromptEditor brainId={brain.id} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {brain && (
        <EditBrainDialog
          brain={{
            id: brain.id,
            name: brain.name,
            description: brain.description,
            type: brain.type,
            tags: (brain as any).tags || [],
          }}
          open={showEdit}
          onOpenChange={setShowEdit}
        />
      )}

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent className="glass">
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Isso excluirá permanentemente o
              cérebro
              <strong> "{brain.name}"</strong> e todas as suas mensagens e
              dados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBrain}
              className="bg-destructive hover:bg-destructive/90 transition-colors"
              disabled={deleting}
            >
              {deleting ? "Excluindo..." : "Sim, excluir cérebro"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
