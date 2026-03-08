import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BRAIN_TYPE_CONFIG, BrainType } from "@/lib/brain-types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquare,
  PlusCircle,
  Clock,
  ChevronRight,
  Settings,
  FileText,
  Brain,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  brainId: string;
  brainName: string;
  open: boolean;
  onClose: () => void;
}

export default function BrainChatPicker({
  brainId,
  brainName,
  open,
  onClose,
}: Props) {
  const navigate = useNavigate();

  const { data: brain } = useQuery({
    queryKey: ["brain-detail-picker", brainId],
    enabled: open && !!brainId,
    queryFn: async () => {
      const { data } = await supabase
        .from("brains")
        .select("*")
        .eq("id", brainId)
        .single();
      return data;
    },
  });

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations-picker", brainId],
    enabled: open && !!brainId,
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id, title, created_at, updated_at")
        .eq("brain_id", brainId)
        .order("updated_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const { data: textsCount } = useQuery({
    queryKey: ["brain-texts-count-picker", brainId],
    enabled: open && !!brainId,
    queryFn: async () => {
      const { count } = await supabase
        .from("brain_texts")
        .select("id", { count: "exact", head: true })
        .eq("brain_id", brainId);
      return count ?? 0;
    },
  });

  const config = brain ? BRAIN_TYPE_CONFIG[brain.type as BrainType] : null;
  const Icon = config?.icon || Brain;

  const goToChat = (convId?: string) => {
    onClose();
    navigate(`/brain/${brainId}`, {
      state: convId ? { conversationId: convId } : undefined,
    });
  };

  const goToSettings = () => {
    onClose();
    navigate(`/brain/${brainId}`, { state: { tab: "settings" } });
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col bg-background"
      >
        {/* Header — Brain Identity */}
        <SheetHeader className="px-6 pt-6 pb-0 space-y-0">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/10 border border-primary/10 shadow-sm">
              <Icon className="h-7 w-7 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-lg font-bold text-foreground leading-tight">
                {brainName}
              </SheetTitle>
              {config && (
                <Badge
                  variant="secondary"
                  className="text-[10px] uppercase tracking-widest font-bold bg-primary/8 text-primary/70 border-0 mt-1.5"
                >
                  {config.label}
                </Badge>
              )}
            </div>
          </div>

          {/* Description */}
          {brain?.description && (
            <p className="text-sm text-muted-foreground leading-relaxed mt-3 line-clamp-3">
              {brain.description}
            </p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              {textsCount ?? 0} fonte{(textsCount ?? 0) !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              {conversations?.length ?? 0} conversa{(conversations?.length ?? 0) !== 1 ? "s" : ""}
            </span>
            {brain?.updated_at && (
              <span className="flex items-center gap-1.5 ml-auto">
                <Clock className="h-3.5 w-3.5" />
                {formatDistanceToNow(new Date(brain.updated_at), { addSuffix: true, locale: ptBR })}
              </span>
            )}
          </div>
        </SheetHeader>

        {/* Quick Actions */}
        <div className="px-6 pt-5 pb-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => goToChat()}
              className="h-12 gap-2 rounded-2xl gradient-jewel text-white font-semibold shadow-md hover:opacity-90 transition-all"
            >
              <PlusCircle className="h-4 w-4" />
              Nova Conversa
            </Button>
            <Button
              variant="outline"
              onClick={goToSettings}
              className="h-12 gap-2 rounded-2xl font-semibold"
            >
              <Settings className="h-4 w-4" />
              Configurar
            </Button>
          </div>
        </div>

        <Separator className="mx-6 mt-2" />

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-2 pb-2 flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            Histórico de Conversas
          </p>

          {isLoading ? (
            <div className="space-y-2 px-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-2xl bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : conversations && conversations.length > 0 ? (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => goToChat(conv.id)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-muted/60 transition-all text-left group"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/8 group-hover:bg-primary/15 transition-colors">
                  <MessageSquare className="h-4 w-4 text-primary/70 group-hover:text-primary transition-colors" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate text-foreground group-hover:text-primary transition-colors">
                    {conv.title ?? "Conversa sem título"}
                  </p>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                    {formatDistanceToNow(
                      new Date(conv.updated_at ?? conv.created_at),
                      { addSuffix: true, locale: ptBR },
                    )}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/60 transition-colors shrink-0" />
              </button>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
              <div className="h-16 w-16 rounded-3xl bg-muted/50 flex items-center justify-center">
                <Sparkles className="h-7 w-7 text-muted-foreground/30" />
              </div>
              <p className="font-semibold text-sm text-foreground">Nenhuma conversa ainda</p>
              <p className="text-xs text-muted-foreground max-w-[200px]">
                Inicie uma nova conversa para explorar {brainName}
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
