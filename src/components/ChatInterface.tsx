import { useState, useRef, useEffect, useCallback } from "react";
import { useSettings } from "@/hooks/useSettings";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { BrainType } from "@/lib/brain-types";
import type { ChatMode } from "@/hooks/useBrainChat";
import type { SummonedMessage } from "@/hooks/useCloneSummon";
import {
  Send, User, Bot, PlusCircle, RefreshCw, AlertTriangle, Square,
  Download, Copy, Check, Zap, Brain, ChevronDown, ChevronRight, UserPlus, Sparkles,
} from "lucide-react";
import ObsidianMarkdown from "@/components/ObsidianMarkdown";
import { Message } from "@/hooks/useBrainChat";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  brainId: string;
  brainType: BrainType;
  brainName: string;
  messages: Message[];
  isStreaming: boolean;
  sendMessage: (input: string, mode?: ChatMode) => void;
  stopStreaming?: () => void;
  onNewChat: () => void;
  conversationId: string | null;
  onRetry?: () => void;
  onRegenerate?: () => void;
  showModeToggle?: boolean;
  summonedMessages?: SummonedMessage[];
  isSummoning?: boolean;
  onSummonClone?: (brainId: string, reason: string) => void;
}

export default function ChatInterface({
  brainType, brainName, messages, isStreaming, sendMessage, stopStreaming,
  onNewChat, conversationId, onRetry, onRegenerate, showModeToggle = true,
  summonedMessages = [], isSummoning = false, onSummonClone,
}: Props) {
  const [input, setInput] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const { language } = useSettings();
  const { t } = useTranslation();
  const [chatMode, setChatMode] = useState<ChatMode>(() => {
    return (localStorage.getItem("chatMode") as ChatMode) || "default";
  });
  const [expandedReasoning, setExpandedReasoning] = useState<Set<number>>(new Set());
  const [showSummonPicker, setShowSummonPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMention, setShowMention] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const setMode = (m: ChatMode) => {
    setChatMode(m);
    localStorage.setItem("chatMode", m);
  };

  const { data: availableBrains } = useQuery({
    queryKey: ["brains_for_summon"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from("brains").select("id, name, type").eq("user_id", user.id).order("name");
      return data || [];
    },
    staleTime: 60_000,
  });

  const filteredBrains = (availableBrains || []).filter(
    (b) => b.name.toLowerCase().includes(mentionQuery.toLowerCase()) && b.id !== brainType,
  );

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 240)}px`;
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    sendMessage(input, chatMode);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "@") { setShowMention(true); setMentionQuery(""); }
    else if (showMention) {
      if (e.key === "Escape") setShowMention(false);
      else if (e.key === "Backspace" && mentionQuery === "") setShowMention(false);
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    const mentionMatch = val.match(/@([\w\s]*)$/);
    if (mentionMatch) { setShowMention(true); setMentionQuery(mentionMatch[1]); }
    else setShowMention(false);
  }, []);

  const handleSelectMention = (brain: { id: string; name: string }) => {
    const newInput = input.replace(/@[\w\s]*$/, "").trim();
    setInput(newInput);
    setShowMention(false);
    if (onSummonClone) onSummonClone(brain.id, `${brain.name}`);
    else toast.info(`Clone "${brain.name}"`);
  };

  const handleCopy = async (content: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(content || "");
      setCopiedIdx(idx);
      toast.success(t("common.copied"));
      setTimeout(() => setCopiedIdx(null), 2000);
    } catch {
      toast.error(t("chat.copyError"));
    }
  };

  const handleExport = () => {
    if (!messages.length) return;
    const youLabel = t("chat.you");
    const lines = messages.map((m) => `**${m.role === "user" ? youLabel : brainName}:**\n${m.content}`);
    const md = `# ${t("chat.conversationWith")} ${brainName}\n\n${lines.join("\n\n---\n\n")}`;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversa-${brainName.replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("chat.conversationExported"));
  };

  const isErrorMessage = (msg: Message) => msg.role === "assistant" && (msg.content || "").includes("⚠️ Erro:");

  const extractReasoning = (content: string) => {
    const match = content.match(/<raciocinio>([\s\S]*?)<\/raciocinio>/);
    if (!match) return { reasoning: null, answer: content };
    const reasoning = match[1].trim();
    const answer = content.replace(/<raciocinio>[\s\S]*?<\/raciocinio>/, "").trim();
    return { reasoning, answer };
  };

  // Translated suggestions
  const SUGGESTIONS: Record<BrainType | "default", string[]> = {
    person_clone: [t("chat.suggestion.person1"), t("chat.suggestion.person2"), t("chat.suggestion.person3")],
    knowledge_base: [t("chat.suggestion.kb1"), t("chat.suggestion.kb2"), t("chat.suggestion.kb3")],
    philosophy: [t("chat.suggestion.phil1"), t("chat.suggestion.phil2"), t("chat.suggestion.phil3")],
    practical_guide: [t("chat.suggestion.guide1"), t("chat.suggestion.guide2"), t("chat.suggestion.guide3")],
    default: [t("chat.suggestion.default1"), t("chat.suggestion.default2"), t("chat.suggestion.default3")],
  };

  const suggestions = SUGGESTIONS[brainType as BrainType] || SUGGESTIONS.default;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-5.5rem)] bg-background">
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 sm:space-y-6 animate-in fade-in duration-700 px-4 py-6">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-secondary flex items-center justify-center border border-border">
              <Bot className="h-8 w-8 sm:h-10 sm:w-10 text-foreground" />
            </div>
            <div className="space-y-1.5">
              <p className="text-xl sm:text-2xl font-bold text-foreground">{t("chat.talkTo")} {brainName}</p>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-xs mx-auto">{t("chat.startOrSuggestion")}</p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-md">
              {suggestions.map((q) => (
                <button key={q} onClick={() => sendMessage(q)} className="text-left text-xs sm:text-sm px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-muted/60 transition-all text-foreground">
                  {q}
                </button>
              ))}
            </div>
            <Button variant="outline" onClick={onNewChat} className="rounded-xl gap-2 transition-all px-5 py-4 sm:px-6 sm:py-5 font-semibold text-sm">
              <PlusCircle className="h-4 w-4" />
              {t("chat.newConversation")}
            </Button>
          </div>
        )}

        {messages.map((msg, i) => {
          const isError = isErrorMessage(msg);
          return (
            <div key={i} className={`group w-full animate-in slide-in-from-bottom-2 duration-300 ${msg.role === "user" ? "bg-muted/40" : ""}`}>
              <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
                <div className="flex gap-3 sm:gap-4">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5 ${
                    msg.role === "user" ? "bg-primary text-primary-foreground"
                      : isError ? "bg-destructive/15 border border-destructive/30 text-destructive"
                      : "bg-secondary border border-border text-foreground"
                  }`}>
                    {msg.role === "user" ? <User className="h-4 w-4" /> : isError ? <AlertTriangle className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-foreground">{msg.role === "user" ? t("chat.you") : brainName}</p>
                      {msg.role === "assistant" && chatMode !== "default" && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${
                          chatMode === "fast" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-violet-500/10 text-violet-500 border-violet-500/20"
                        }`}>
                          {chatMode === "fast" ? t("chat.fast") : t("chat.thinking")}
                        </span>
                      )}
                    </div>
                    <div className="text-[15px] leading-7 text-foreground">
                      {msg.role === "assistant" ? (
                        <div className="space-y-2">
                          {(() => {
                            const { reasoning, answer } = extractReasoning(msg.content || "");
                            const isExpanded = expandedReasoning.has(i);
                            return (
                              <>
                                {reasoning && (
                                  <div className="mb-2">
                                    <button onClick={() => setExpandedReasoning((prev) => { const next = new Set(prev); isExpanded ? next.delete(i) : next.add(i); return next; })}
                                      className="flex items-center gap-1.5 text-xs font-semibold text-primary/70 hover:text-primary transition-colors py-1">
                                      {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                      {t("chat.reasoning")}
                                    </button>
                                    {isExpanded && (
                                      <div className="mt-1 pl-3 border-l-2 border-primary/20 text-sm text-muted-foreground leading-relaxed">
                                        <ObsidianMarkdown content={reasoning} />
                                      </div>
                                    )}
                                  </div>
                                )}
                                <ObsidianMarkdown content={isError ? (answer || msg.content || "").replace("⚠️ Erro:", "").trim() : answer || msg.content || ""} isError={isError} />
                              </>
                            );
                          })()}
                          {isError && onRetry && (
                            <Button variant="outline" size="sm" onClick={onRetry}
                              className="gap-1.5 rounded-lg text-xs border-destructive/30 hover:bg-destructive/10 hover:border-destructive/50 text-destructive font-semibold mt-2">
                              <RefreshCw className="h-3 w-3" />
                              {t("chat.tryAgain")}
                            </Button>
                          )}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content || ""}</p>
                      )}
                    </div>
                    {msg.role === "assistant" && !isStreaming && (
                      <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button onClick={() => handleCopy(msg.content || "", i)} title={t("common.copy")}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
                          {copiedIdx === i ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedIdx === i ? t("common.copied") : t("common.copy")}
                        </button>
                        {i === messages.length - 1 && onRegenerate && (
                          <button onClick={onRegenerate} title={t("chat.regenerate")}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
                            <RefreshCw className="h-3.5 w-3.5" />
                            {t("chat.regenerate")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="w-full">
            <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
              <div className="flex gap-3 sm:gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary border border-border text-foreground">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex items-center pt-2">
                  <div className="flex gap-1.5 items-center">
                    <span className="h-2 w-2 bg-foreground/60 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="h-2 w-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="h-2 w-2 bg-foreground/20 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {summonedMessages.map((sm, si) => (
          <div key={`summoned-${si}`} className="w-full border-t border-violet-500/10">
            <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
              <div className="flex gap-3 sm:gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/20 border border-violet-500/30">
                  <Sparkles className="h-4 w-4 text-violet-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-violet-400">{sm.cloneName}</p>
                    <span className="text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-full px-2 py-0.5">{t("chat.summoned")}</span>
                  </div>
                  <div className="text-[15px] leading-7 text-foreground">
                    {sm.content ? <ObsidianMarkdown content={sm.content} /> : (
                      <div className="flex gap-1.5">
                        <span className="h-2 w-2 bg-violet-400/60 rounded-full animate-bounce [animation-delay:0ms]" />
                        <span className="h-2 w-2 bg-violet-400/40 rounded-full animate-bounce [animation-delay:150ms]" />
                        <span className="h-2 w-2 bg-violet-400/20 rounded-full animate-bounce [animation-delay:300ms]" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {isSummoning && (
          <div className="max-w-3xl mx-auto px-3 sm:px-4 py-2">
            <div className="flex items-center gap-2 text-xs text-violet-400/80">
              <Sparkles className="h-3 w-3 animate-pulse" />
              {t("chat.summoning")}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border/40 bg-card/60 backdrop-blur-xl px-3 sm:px-4 py-2 sm:py-3 pb-[env(safe-area-inset-bottom,8px)] sm:pb-3">
        {messages.length > 0 && (
          <div className="max-w-3xl mx-auto flex items-center gap-1 sm:gap-2 mb-1.5 sm:mb-2 overflow-x-auto no-scrollbar">
            <Button variant="ghost" size="sm" onClick={handleExport}
              className="gap-1 h-7 px-2 sm:px-3 text-[10px] sm:text-xs rounded-xl text-muted-foreground hover:text-foreground shrink-0">
              <Download className="h-3 w-3" />
              <span className="hidden sm:inline">{t("common.export")}</span>
            </Button>

            {onSummonClone && (
              <div className="relative shrink-0">
                <Button variant="ghost" size="sm" onClick={() => setShowSummonPicker((p) => !p)} disabled={isSummoning}
                  className="gap-1 h-7 px-2 sm:px-3 text-[10px] sm:text-xs rounded-xl text-violet-400 hover:text-violet-300 hover:bg-violet-500/10">
                  <UserPlus className="h-3 w-3" />
                  <span className="hidden sm:inline">{isSummoning ? t("chat.invoking") : t("chat.clone")}</span>
                </Button>
                {showSummonPicker && (
                  <div className="absolute bottom-full mb-1 left-0 z-50 w-52 rounded-xl border border-border/60 bg-card shadow-lg shadow-black/20 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
                    <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 border-b border-border/40">{t("chat.callClone")}</p>
                    <div className="max-h-48 overflow-y-auto">
                      {(availableBrains || []).map((b) => (
                        <button key={b.id} onClick={() => { setShowSummonPicker(false); onSummonClone(b.id, `${b.name}`); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors flex items-center gap-2">
                          <Sparkles className="h-3 w-3 text-violet-400 shrink-0" />
                          <span className="truncate">{b.name}</span>
                        </button>
                      ))}
                      {(availableBrains || []).length === 0 && (
                        <p className="px-3 py-2 text-xs text-muted-foreground">{t("chat.noClones")}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {showModeToggle && (
              <div className="ml-auto flex items-center rounded-xl border border-border/60 bg-background/60 p-0.5 gap-0.5 shrink-0">
                <button onClick={() => setMode("fast")} title={t("chat.fastDesc")}
                  className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-semibold transition-all ${chatMode === "fast" ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" : "text-muted-foreground hover:text-foreground"}`}>
                  <Zap className="h-3 w-3" /> <span className="hidden sm:inline">{t("chat.fast")}</span>
                </button>
                <button onClick={() => setMode("default")}
                  className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-semibold transition-all ${chatMode === "default" ? "bg-primary/15 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground"}`}>
                  {t("chat.default")}
                </button>
                <button onClick={() => setMode("thinking")} title={t("chat.thinkingDesc")}
                  className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-semibold transition-all ${chatMode === "thinking" ? "bg-violet-500/15 text-violet-400 border border-violet-500/30" : "text-muted-foreground hover:text-foreground"}`}>
                  <Brain className="h-3 w-3" /> <span className="hidden sm:inline">{t("chat.thinking")}</span>
                </button>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex items-end gap-2">
          {showMention && filteredBrains.length > 0 && (
            <div className="absolute bottom-full mb-1 left-4 z-50 w-52 rounded-xl border border-border/60 bg-card shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
              <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 border-b border-border/40">@Clone</p>
              {filteredBrains.map((b) => (
                <button key={b.id} type="button" onClick={() => handleSelectMention(b)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors flex items-center gap-2">
                  <Sparkles className="h-3 w-3 text-violet-400 shrink-0" />
                  <span className="truncate">{b.name}</span>
                </button>
              ))}
            </div>
          )}
          <div className="relative flex-1 bg-background/80 border border-border/60 rounded-2xl shadow-inner focus-within:border-primary/50 focus-within:shadow-primary/10 focus-within:shadow-lg transition-all duration-300">
            <textarea ref={inputRef} value={input} onChange={handleInputChange} onKeyDown={handleKeyDown}
              placeholder={t("chat.placeholder")} disabled={isStreaming} rows={1} spellCheck lang={language}
              className="w-full resize-none bg-transparent text-sm px-3 sm:px-4 py-3 pr-2 outline-none text-foreground placeholder:text-muted-foreground overflow-y-auto"
              style={{ maxHeight: "120px" }} />
          </div>

          {isStreaming && stopStreaming ? (
            <Button type="button" size="icon" onClick={stopStreaming}
              className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl shrink-0 bg-destructive/20 hover:bg-destructive/30 border border-destructive/40 text-destructive transition-all active:scale-95 shadow-none">
              <Square className="h-4 w-4 fill-current" />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!input.trim() || isStreaming}
              className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl shrink-0 bg-gradient-to-br from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all active:scale-95 disabled:opacity-40 disabled:shadow-none">
              <Send className="h-4 w-4" />
            </Button>
          )}
        </form>
        <p className="text-[10px] text-muted-foreground/60 text-center mt-1.5 hidden sm:block">{t("common.shiftEnter")}</p>
      </div>
    </div>
  );
}
