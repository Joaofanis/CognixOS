import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { BrainType } from "@/lib/brain-types";
import {
  Send,
  Loader2,
  User,
  Bot,
  Sparkles,
  PlusCircle,
  RefreshCw,
  AlertTriangle,
  Square,
  Download,
  Copy,
  Check,
} from "lucide-react";
import ObsidianMarkdown from "@/components/ObsidianMarkdown";
import { Message } from "@/hooks/useBrainChat";
import { toast } from "sonner";

interface Props {
  brainId: string;
  brainType: BrainType;
  brainName: string;
  messages: Message[];
  isStreaming: boolean;
  sendMessage: (input: string) => void;
  stopStreaming?: () => void;
  onNewChat: () => void;
  conversationId: string | null;
  onRetry?: () => void;
  onRegenerate?: () => void;
}

// Suggested questions per brain type
const SUGGESTIONS: Record<BrainType | "default", string[]> = {
  person_clone: [
    "Como você se aproximaria de um problema difícil?",
    "Qual é a sua visão sobre aprendizado contínuo?",
    "O que te motiva no dia a dia?",
  ],
  knowledge_base: [
    "Quais são os principais tópicos que você conhece?",
    "Me dê um resumo do que você sabe sobre esse assunto",
    "Quais são as ideias mais importantes aqui?",
  ],
  philosophy: [
    "Qual é a sua posição filosófica central?",
    "Como você pensa sobre ética e tomada de decisão?",
    "O que define sua visão de mundo?",
  ],
  practical_guide: [
    "Como você aplicaria esse conhecimento na prática?",
    "Qual é o primeiro passo que você recomenda?",
    "Me dê um passo a passo para começar",
  ],
  default: [
    "O que você sabe sobre esse assunto?",
    "Me conte mais sobre você",
    "Qual é a ideia mais importante aqui?",
  ],
};

export default function ChatInterface({
  brainType,
  brainName,
  messages,
  isStreaming,
  sendMessage,
  stopStreaming,
  onNewChat,
  conversationId,
  onRetry,
  onRegenerate,
}: Props) {
  const [input, setInput] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
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
    sendMessage(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const handleSuggestion = (q: string) => {
    sendMessage(q);
  };

  const handleCopy = async (content: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(content || "");
      setCopiedIdx(idx);
      toast.success("Copiado!");
      setTimeout(() => setCopiedIdx(null), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  const handleExport = () => {
    if (!messages.length) return;
    const lines = messages.map(
      (m) => `**${m.role === "user" ? "Você" : brainName}:**\n${m.content}`,
    );
    const md = `# Conversa com ${brainName}\n\n${lines.join("\n\n---\n\n")}`;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversa-${brainName.replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Conversa exportada!");
  };

  const isErrorMessage = (msg: Message) =>
    msg.role === "assistant" && (msg.content || "").includes("⚠️ Erro:");

  const suggestions =
    SUGGESTIONS[brainType as BrainType] || SUGGESTIONS.default;

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)] bg-background">
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-thin"
      >
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6 animate-in fade-in duration-700 px-4">
            <div className="h-20 w-20 rounded-2xl bg-secondary flex items-center justify-center border border-border">
              <Bot className="h-10 w-10 text-foreground" />
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-foreground">
                Converse com {brainName}
              </p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Comece uma conversa ou use uma das sugestões abaixo.
              </p>
            </div>

            <div className="flex flex-col gap-2 w-full max-w-md">
              {suggestions.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSuggestion(q)}
                  className="text-left text-sm px-4 py-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-muted/60 transition-all text-foreground"
                >
                  {q}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              onClick={onNewChat}
              className="rounded-xl gap-2 transition-all px-6 py-5 font-semibold"
            >
              <PlusCircle className="h-4 w-4" />
              Nova Conversa
            </Button>
          </div>
        )}

        {messages.map((msg, i) => {
          const isError = isErrorMessage(msg);
          return (
            <div
              key={i}
              className={`group w-full animate-in slide-in-from-bottom-2 duration-300 ${
                msg.role === "user" ? "bg-muted/40" : ""
              }`}
            >
              <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
                <div className="flex gap-3 sm:gap-4">
                  {/* Avatar */}
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : isError
                          ? "bg-destructive/15 border border-destructive/30 text-destructive"
                          : "bg-secondary border border-border text-foreground"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <User className="h-4 w-4" />
                    ) : isError ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground mb-1">
                      {msg.role === "user" ? "Você" : brainName}
                    </p>
                    <div className="text-[15px] leading-7 text-foreground">
                      {msg.role === "assistant" ? (
                        <div className="space-y-2">
                          <ObsidianMarkdown
                            content={
                              isError
                                ? (msg.content || "").replace("⚠️ Erro:", "").trim()
                                : msg.content || ""
                            }
                            isError={isError}
                          />
                          {isError && onRetry && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={onRetry}
                              className="gap-1.5 rounded-lg text-xs border-destructive/30 hover:bg-destructive/10 hover:border-destructive/50 text-destructive font-semibold mt-2"
                            >
                              <RefreshCw className="h-3 w-3" />
                              Tentar novamente
                            </Button>
                          )}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">
                          {msg.content || ""}
                        </p>
                      )}
                    </div>

                    {/* Action buttons */}
                    {msg.role === "assistant" && !isStreaming && (
                      <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          onClick={() => handleCopy(msg.content || "", i)}
                          title="Copiar resposta"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                        >
                          {copiedIdx === i ? (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          {copiedIdx === i ? "Copiado!" : "Copiar"}
                        </button>
                        {i === messages.length - 1 && onRegenerate && (
                          <button
                            onClick={onRegenerate}
                            title="Gerar novamente"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Regenerar
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

        {/* Streaming dots indicator */}
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
      </div>

      {/* Input Bar */}
      <div className="border-t border-border/40 bg-card/60 backdrop-blur-xl px-3 sm:px-4 py-3 pb-5 sm:pb-3">
        {/* Toolbar row */}
        {messages.length > 0 && (
          <div className="max-w-3xl mx-auto flex items-center gap-2 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExport}
              className="gap-1.5 h-7 px-3 text-xs rounded-xl text-muted-foreground hover:text-foreground"
            >
              <Download className="h-3 w-3" />
              Exportar
            </Button>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto flex items-end gap-2 sm:gap-3"
        >
          <div className="relative flex-1 bg-background/80 border border-border/60 rounded-2xl sm:rounded-3xl shadow-inner focus-within:border-primary/50 focus-within:shadow-primary/10 focus-within:shadow-lg transition-all duration-300">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Envie uma mensagem… (Enter para enviar)"
              disabled={isStreaming}
              rows={1}
              spellCheck
              className="w-full resize-none bg-transparent text-sm px-4 py-3.5 pr-2 outline-none text-foreground placeholder:text-muted-foreground overflow-y-auto"
            />
          </div>

          {/* Stop button when streaming, Send when not */}
          {isStreaming && stopStreaming ? (
            <Button
              type="button"
              size="icon"
              onClick={stopStreaming}
              className="h-11 w-11 rounded-2xl shrink-0 bg-destructive/20 hover:bg-destructive/30 border border-destructive/40 text-destructive transition-all active:scale-95 shadow-none"
            >
              <Square className="h-4 w-4 fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isStreaming}
              className="h-11 w-11 rounded-2xl shrink-0 bg-gradient-to-br from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all active:scale-95 disabled:opacity-40 disabled:shadow-none"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </form>
        <p className="text-[10px] text-muted-foreground/60 text-center mt-2">
          Shift+Enter para nova linha
        </p>
      </div>
    </div>
  );
}
