import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MessageSquare, PlusCircle, Clock, ChevronRight } from "lucide-react";
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

  const goToChat = (convId?: string) => {
    onClose();
    navigate(`/brain/${brainId}`, {
      state: convId ? { conversationId: convId } : undefined,
    });
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-sm p-0 flex flex-col"
      >
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/50">
          <SheetTitle className="flex items-center gap-2 text-base font-bold">
            <MessageSquare className="h-4 w-4 text-accent" />
            {brainName}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
              Carregando conversas…
            </div>
          ) : conversations && conversations.length > 0 ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-2 pb-1">
                Conversas recentes
              </p>
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => goToChat(conv.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-primary/8 transition-colors text-left group"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <MessageSquare className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {conv.title ?? "Conversa"}
                    </p>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 mt-0.5">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(
                        new Date(conv.updated_at ?? conv.created_at),
                        {
                          addSuffix: true,
                          locale: ptBR,
                        },
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                </button>
              ))}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-4">
              <div className="h-14 w-14 rounded-3xl bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-primary/60" />
              </div>
              <p className="font-semibold text-sm">Nenhuma conversa ainda</p>
              <p className="text-xs text-muted-foreground">
                Comece uma nova conversa com {brainName}
              </p>
            </div>
          )}
        </div>

        {/* Footer: always show "New Chat" button */}
        <div className="border-t border-border/50 px-4 py-4">
          <Button
            className="w-full gap-2 gradient-jewel text-white font-semibold rounded-2xl shadow-md"
            onClick={() => goToChat()}
          >
            <PlusCircle className="h-4 w-4" />
            Nova Conversa
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
