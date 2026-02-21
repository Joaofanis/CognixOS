import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { BrainType } from "@/lib/brain-types";
import { Send, Loader2, User, Bot, Sparkles, PlusCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Message } from "@/hooks/useBrainChat";

interface Props {
  brainId: string;
  brainType: BrainType;
  brainName: string;
  messages: Message[];
  isStreaming: boolean;
  sendMessage: (input: string) => void;
  onNewChat: () => void;
  conversationId: string | null;
}

export default function ChatInterface({ 
  brainType, 
  brainName,
  messages,
  isStreaming,
  sendMessage,
  onNewChat,
  conversationId
}: Props) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 160)}px`;
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

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)] bg-mesh">
      {/* Messages */}
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto px-4 py-6 space-y-6 scrollbar-thin"
      >
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6 animate-in fade-in duration-700">
            <div className="relative">
              <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border border-primary/20 shadow-xl shadow-primary/10 pulse-ring">
                <Bot className="h-12 w-12 text-primary" />
              </div>
              <div className="absolute -top-1 -right-1 h-6 w-6 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center shadow-lg">
                <Sparkles className="h-3 w-3 text-white" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-gradient">
                Converse com {brainName}
              </p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Comece uma nova conversa ou continue de onde parou.
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={onNewChat}
              className="rounded-2xl gap-2 border-primary/30 hover:bg-primary/10 hover:border-primary/60 transition-all px-6 py-5 text-primary font-semibold shadow-sm"
            >
              <PlusCircle className="h-4 w-4" />
              Nova Conversa
            </Button>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex items-end gap-3 animate-in slide-in-from-bottom-2 duration-300 ${
              msg.role === "user" ? "flex-row-reverse" : "flex-row"
            }`}
          >
            {/* Avatar */}
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl shadow-md ${
              msg.role === "user" 
                ? "bg-gradient-to-br from-primary to-violet-600 text-white" 
                : "bg-gradient-to-br from-card to-secondary border border-border text-primary"
            }`}>
              {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            
            {/* Bubble */}
            <div
              className={`max-w-[80%] sm:max-w-[75%] px-4 py-3 text-sm shadow-sm ${
                msg.role === "user"
                  ? "bg-gradient-to-br from-primary to-violet-600 text-white rounded-3xl rounded-br-md"
                  : "bg-card/90 backdrop-blur-sm border border-border/60 text-card-foreground rounded-3xl rounded-bl-md"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none break-words leading-relaxed [&>p]:mb-2 [&>p:last-child]:mb-0">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        
        {/* Streaming indicator */}
        {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex items-end gap-3 animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-card to-secondary border border-border text-primary shadow-md">
              <Bot className="h-4 w-4" />
            </div>
            <div className="bg-card/90 backdrop-blur-sm border border-border/60 rounded-3xl rounded-bl-md px-5 py-4">
              <div className="flex gap-1.5 items-center">
                <span className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="h-2 w-2 bg-primary/70 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="h-2 w-2 bg-primary/40 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="border-t border-border/40 bg-card/60 backdrop-blur-xl px-4 py-3 pb-5 sm:pb-3">
        <form
          onSubmit={handleSubmit}
          className="container max-w-3xl flex items-end gap-3"
        >
          <div className="relative flex-1 bg-background/80 border border-border/60 rounded-3xl shadow-inner focus-within:border-primary/50 focus-within:shadow-primary/10 focus-within:shadow-lg transition-all duration-300">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Envie uma mensagem… (Enter para enviar)"
              disabled={isStreaming}
              rows={1}
              className="w-full resize-none bg-transparent text-sm px-4 py-3.5 pr-2 outline-none text-foreground placeholder:text-muted-foreground overflow-hidden"
            />
          </div>
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isStreaming}
            className="h-11 w-11 rounded-2xl shrink-0 bg-gradient-to-br from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all active:scale-95 disabled:opacity-40 disabled:shadow-none"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        <p className="text-[10px] text-muted-foreground/60 text-center mt-2">
          Shift+Enter para nova linha
        </p>
      </div>
    </div>
  );
}
