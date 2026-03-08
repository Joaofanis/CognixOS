import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BRAIN_TYPE_CONFIG, BrainType } from "@/lib/brain-types";
import { useTranslation } from "@/lib/i18n";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet, SheetContent, SheetTitle,
} from "@/components/ui/sheet";
import {
  Drawer, DrawerContent, DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  MessageSquare, PlusCircle, Clock, ChevronRight, Settings, FileText, Brain, Sparkles,
  Trash2, Pencil, Check, X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";
import { toast } from "sonner";

interface Props {
  brainId: string;
  brainName: string;
  open: boolean;
  onClose: () => void;
}

export default function BrainChatPicker({ brainId, brainName, open, onClose }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, language } = useTranslation();
  const isMobile = useIsMobile();
  const dateLocale = language === "en-US" ? enUS : language === "es-ES" ? es : ptBR;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const { data: brain } = useQuery({
    queryKey: ["brain-detail-picker", brainId],
    enabled: open && !!brainId,
    queryFn: async () => {
      const { data } = await supabase.from("brains").select("*").eq("id", brainId).single();
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

  const handleRename = async (convId: string) => {
    const trimmed = editingTitle.trim();
    if (!trimmed) { setEditingId(null); return; }
    try {
      const { error } = await supabase.from("conversations").update({ title: trimmed }).eq("id", convId);
      if (error) throw error;
      toast.success(t("picker.conversationRenamed"));
      queryClient.invalidateQueries({ queryKey: ["conversations-picker", brainId] });
      queryClient.invalidateQueries({ queryKey: ["conversations", brainId] });
    } catch (err: any) {
      toast.error(err.message);
    }
    setEditingId(null);
  };

  const handleDelete = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    try {
      const { error } = await supabase.from("conversations").delete().eq("id", convId);
      if (error) throw error;
      toast.success(t("picker.conversationDeleted"));
      queryClient.invalidateQueries({ queryKey: ["conversations-picker", brainId] });
      queryClient.invalidateQueries({ queryKey: ["conversations", brainId] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  /* ── Info section (brain details + action buttons) ── */
  const infoContent = (
    <div className={isMobile ? "px-4 pt-3 pb-0 space-y-0" : "px-5 pt-5 pb-5 space-y-0 flex flex-col h-full"}>
      <div className="flex items-start gap-3">
        <div className={`flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/10 border border-primary/10 shadow-sm ${isMobile ? "h-10 w-10" : "h-12 w-12"}`}>
          <Icon className={isMobile ? "h-5 w-5 text-primary" : "h-6 w-6 text-primary"} />
        </div>
        <div className="min-w-0 flex-1">
          {isMobile ? (
            <DrawerTitle className="text-lg font-bold text-foreground leading-tight">
              {brainName}
            </DrawerTitle>
          ) : (
            <SheetTitle className="text-lg font-bold text-foreground leading-tight">
              {brainName}
            </SheetTitle>
          )}
          {config && (
            <Badge variant="secondary" className="text-[10px] uppercase tracking-widest font-bold bg-primary/8 text-primary/70 border-0 mt-1">
              {config.label}
            </Badge>
          )}
        </div>
      </div>

      {brain?.description && (
        <p className={`text-sm text-muted-foreground leading-relaxed ${isMobile ? "mt-2" : "mt-3"}`}>
          {brain.description}
        </p>
      )}

      <div className={`flex items-center gap-3 text-xs text-muted-foreground flex-wrap ${isMobile ? "mt-2" : "mt-3"}`}>
        <span className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          {textsCount ?? 0} {(textsCount ?? 0) !== 1 ? t("dashboard.sources") : t("dashboard.source")}
        </span>
        <span className="flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />
          {conversations?.length ?? 0} {(conversations?.length ?? 0) !== 1 ? t("dashboard.conversations") : t("dashboard.conversation")}
        </span>
        {brain?.updated_at && (
          <span className="flex items-center gap-1.5 ml-auto">
            <Clock className="h-3.5 w-3.5" />
            {formatDistanceToNow(new Date(brain.updated_at), { addSuffix: true, locale: dateLocale })}
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className={isMobile ? "pt-3 pb-2" : "pt-4 mt-auto"}>
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => goToChat()}
            className={`gap-2 rounded-2xl gradient-jewel text-white font-semibold shadow-md hover:opacity-90 transition-all text-sm ${isMobile ? "h-9" : "h-11"}`}
          >
            <PlusCircle className="h-4 w-4" />
            {t("picker.newConversation")}
          </Button>
          <Button variant="outline" onClick={goToSettings} className={`gap-2 rounded-2xl font-semibold text-sm ${isMobile ? "h-9" : "h-11"}`}>
            <Settings className="h-4 w-4" />
            {t("picker.configure")}
          </Button>
        </div>
      </div>
    </div>
  );

  /* ── Chat list section (conversation history) ── */
  const chatListContent = (
    <div className={`flex-1 overflow-y-auto ${isMobile ? "px-3 py-2" : "px-3 py-3"} space-y-1`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-2 pb-2 flex items-center gap-1.5">
        <Clock className="h-3 w-3" />
        {t("picker.conversationHistory")}
      </p>

      {isLoading ? (
        <div className="space-y-2 px-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-2xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : conversations && conversations.length > 0 ? (
        conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => { if (editingId !== conv.id) goToChat(conv.id); }}
            className={`w-full flex items-center gap-3 px-3 rounded-2xl hover:bg-muted/60 transition-all text-left group cursor-pointer ${isMobile ? "py-2" : "py-2.5"}`}
          >
            <div className={`flex shrink-0 items-center justify-center rounded-xl bg-primary/8 group-hover:bg-primary/15 transition-colors ${isMobile ? "h-7 w-7" : "h-8 w-8"}`}>
              <MessageSquare className="h-3.5 w-3.5 text-primary/70 group-hover:text-primary transition-colors" />
            </div>
            <div className="min-w-0 flex-1">
              {editingId === conv.id ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(conv.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    className="h-7 text-sm px-2"
                  />
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-primary hover:bg-primary/10" onClick={(e) => { e.stopPropagation(); handleRename(conv.id); }}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:bg-muted" onClick={(e) => { e.stopPropagation(); setEditingId(null); }}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium truncate text-foreground group-hover:text-primary transition-colors">
                    {conv.title ?? t("picker.untitled")}
                  </p>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                    {formatDistanceToNow(
                      new Date(conv.updated_at ?? conv.created_at),
                      { addSuffix: true, locale: dateLocale },
                    )}
                  </p>
                </>
              )}
            </div>
            {editingId !== conv.id && (
              <div className="flex items-center gap-0.5 shrink-0">
                <Button
                  variant="ghost" size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted rounded-md"
                  onClick={(e) => { e.stopPropagation(); setEditingId(conv.id); setEditingTitle(conv.title || ""); }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/15 hover:text-destructive rounded-md"
                  onClick={(e) => handleDelete(e, conv.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        ))
      ) : (
        <div className={`flex flex-col items-center justify-center gap-2 text-center px-4 ${isMobile ? "py-5" : "py-8"}`}>
          <div className="h-14 w-14 rounded-3xl bg-muted/50 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-muted-foreground/30" />
          </div>
          <p className="font-semibold text-sm text-foreground">{t("picker.noConversations")}</p>
          <p className="text-xs text-muted-foreground max-w-[200px]">
            {t("picker.startConversation")} {brainName}
          </p>
        </div>
      )}
    </div>
  );

  /* ── Mobile: single-column Drawer ── */
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
        <DrawerContent className="bg-background max-h-[80vh]">
          <div className="flex flex-col overflow-hidden">
            {infoContent}
            <Separator className="mx-4 mt-1" />
            {chatListContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  /* ── Desktop: two-column Sheet ── */
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-row bg-background">
        {/* Left column — brain info */}
        <div className="w-[40%] shrink-0 border-r border-border flex flex-col">
          {infoContent}
        </div>
        {/* Right column — conversations */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {chatListContent}
        </div>
      </SheetContent>
    </Sheet>
  );
}
