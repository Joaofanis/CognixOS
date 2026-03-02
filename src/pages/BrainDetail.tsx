import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
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
  Clock,
  MoreVertical,
  Pencil,
  Trash2,
  PlusCircle,
  Brain as BrainIcon,
  Sparkles,
  PanelLeftClose,
  PanelLeft,
  Menu,
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
} from "@/components/ui/sheet";
import EditBrainDialog from "@/components/EditBrainDialog";
import { useBrainChat } from "@/hooks/useBrainChat";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

export default function BrainDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isMobile = useIsMobile();

  const userResetRef = useRef(false);
  const location = useLocation();
  const locationConvId = (location.state as { conversationId?: string } | null)
    ?.conversationId;

  const {
    messages,
    isStreaming,
    sendMessage,
    stopStreaming,
    loadHistory,
    conversationId,
    resetChat,
    retry,
  } = useBrainChat({
    brainId: id!,
    onConversationCreated: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations", id] });
    },
  });

  const handleNewChat = () => {
    userResetRef.current = true;
    resetChat();
    if (isMobile) setMobileSidebarOpen(false);
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

  const locationHandledRef = useRef(false);

  useEffect(() => {
    if (locationConvId && !locationHandledRef.current) {
      locationHandledRef.current = true;
      loadHistory(locationConvId);
      return;
    }
    if (
      !locationConvId &&
      !conversationId &&
      conversations &&
      conversations.length > 0 &&
      messages.length === 0 &&
      !userResetRef.current
    ) {
      loadHistory(conversations[0].id);
    }
  }, [conversations, conversationId]);

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

  // Group conversations by date
  const groupConversations = () => {
    if (!conversations) return [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const weekAgo = new Date(today.getTime() - 7 * 86400000);
    const monthAgo = new Date(today.getTime() - 30 * 86400000);

    const groups: { label: string; items: typeof conversations }[] = [
      { label: "Hoje", items: [] },
      { label: "Ontem", items: [] },
      { label: "Últimos 7 dias", items: [] },
      { label: "Últimos 30 dias", items: [] },
      { label: "Mais antigas", items: [] },
    ];

    for (const conv of conversations) {
      const d = new Date(conv.updated_at);
      if (d >= today) groups[0].items.push(conv);
      else if (d >= yesterday) groups[1].items.push(conv);
      else if (d >= weekAgo) groups[2].items.push(conv);
      else if (d >= monthAgo) groups[3].items.push(conv);
      else groups[4].items.push(conv);
    }

    return groups.filter((g) => g.items.length > 0);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Sidebar header */}
      <div className="p-3 border-b border-border/50">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 rounded-xl h-10 border border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/8 transition-all text-primary font-semibold text-sm"
          onClick={handleNewChat}
        >
          <PlusCircle className="h-4 w-4" />
          Nova Conversa
        </Button>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-3">
          {conversations?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground/60 italic text-xs">
              Nenhuma conversa ainda
            </div>
          ) : (
            groupConversations().map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-2 mb-1">
                  {group.label}
                </p>
                {group.items.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => {
                      userResetRef.current = false;
                      loadHistory(conv.id);
                      if (isMobile) setMobileSidebarOpen(false);
                    }}
                    className={`group flex items-center gap-2 w-full text-left px-2.5 py-2 rounded-lg transition-all cursor-pointer text-sm ${
                      conversationId === conv.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground/80 hover:bg-muted/60"
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-50" />
                    <span className="truncate flex-1">
                      {conv.title || "Nova Conversa"}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/15 hover:text-destructive rounded-md shrink-0"
                      onClick={(e) => handleDeleteConversation(e, conv.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Sidebar footer - brain info */}
      <div className="p-3 border-t border-border/50">
        <div
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/60 cursor-pointer transition-colors"
          onClick={() => navigate("/")}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate">{brain.name}</p>
            <p className="text-[10px] text-muted-foreground">{config?.label}</p>
          </div>
        </div>
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

      {/* Mobile Sidebar Sheet */}
      <Sheet open={mobileSidebarOpen && !!isMobile} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="p-0 w-[280px] bg-sidebar-background">
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="flex h-12 items-center gap-2 px-3">
            {/* Sidebar toggle */}
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
              <h1 className="font-bold text-sm truncate leading-tight">
                {brain.name}
              </h1>
            </div>

            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-lg h-8 w-8"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 rounded-xl">
                  <DropdownMenuItem
                    onClick={() => setShowEdit(true)}
                    className="gap-2 cursor-pointer rounded-lg m-1"
                  >
                    <Pencil className="h-4 w-4" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setShowDelete(true)}
                    className="gap-2 cursor-pointer text-destructive focus:text-destructive rounded-lg m-1"
                  >
                    <Trash2 className="h-4 w-4" /> Excluir Cérebro
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <Tabs defaultValue="chat" className="flex-1 flex flex-col min-h-0">
          <div className="border-b border-border/40 bg-card/40 backdrop-blur-xl">
            <TabsList className="h-10 w-full justify-start bg-transparent p-0 gap-4 px-3">
              <TabsTrigger
                value="chat"
                className="gap-1.5 px-1 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none font-semibold transition-all text-xs text-muted-foreground"
              >
                <MessageSquare className="h-3.5 w-3.5" /> Chat
              </TabsTrigger>
              <TabsTrigger
                value="texts"
                className="gap-1.5 px-1 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none font-semibold transition-all text-xs text-muted-foreground"
              >
                <FileText className="h-3.5 w-3.5" /> Fontes
              </TabsTrigger>
              <TabsTrigger
                value="analysis"
                className="gap-1.5 px-1 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none font-semibold transition-all text-xs text-muted-foreground"
              >
                <BarChart3 className="h-3.5 w-3.5" /> Análise
              </TabsTrigger>
              <TabsTrigger
                value="prompt"
                className="gap-1.5 px-1 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none font-semibold transition-all text-xs text-muted-foreground"
              >
                <Sparkles className="h-3.5 w-3.5" /> Prompt
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="chat" className="flex-1 m-0 min-h-0">
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
              onRegenerate={retry}
            />
          </TabsContent>
          <TabsContent value="texts" className="m-0 bg-background/50 flex-1 overflow-y-auto">
            <FeedTexts brainId={brain.id} />
          </TabsContent>
          <TabsContent value="analysis" className="m-0 bg-background/50 flex-1 overflow-y-auto">
            <BrainAnalysis
              brainId={brain.id}
              brainType={brain.type as BrainType}
            />
          </TabsContent>
          <TabsContent value="prompt" className="m-0 bg-background/50 flex-1 overflow-y-auto">
            <BrainPromptEditor brainId={brain.id} />
          </TabsContent>
        </Tabs>
      </div>

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
        <AlertDialogContent>
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
