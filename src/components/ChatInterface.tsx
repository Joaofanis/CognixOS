import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrainType } from "@/lib/brain-types";
import { Send, Loader2, User, Bot, PlusCircle } from "lucide-react";
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
  brainId, 
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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    sendMessage(input);
    setInput("");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)] bg-background/50">
      {/* Messages */}
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth"
      >
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 animate-in fade-in duration-700">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
              <Bot className="h-10 w-10 text-primary" />
            </div>
            <div>
              <p className="text-xl font-semibold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Converse com {brainName}
              </p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-2">
                Comece uma nova conversa ou continue de onde parou.
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onNewChat}
                className="mt-6 rounded-full gap-2 border-primary/20 hover:bg-primary/5 hover:border-primary/40 transition-all"
              >
                <PlusCircle className="h-4 w-4" />
                Nova Conversa
              </Button>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 animate-in slide-in-from-bottom-2 duration-300 ${
              msg.role === "user" ? "flex-row-reverse" : "flex-row"
            }`}
          >
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border shadow-sm ${
              msg.role === "user" ? "bg-primary border-primary text-primary-foreground" : "bg-card border-border text-primary"
            }`}>
              {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm border ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground border-primary rounded-tr-none"
                  : "bg-card text-card-foreground border-border rounded-tl-none"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none break-words leading-relaxed">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        
        {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex items-start gap-3 animate-pulse">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-primary">
              <Bot className="h-4 w-4" />
            </div>
            <div className="bg-muted rounded-2xl px-4 py-4 rounded-tl-none">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t bg-card/80 backdrop-blur-md p-4 pb-6 sm:pb-4">
        <form
          onSubmit={handleSubmit}
          className="container max-w-3xl flex gap-2 relative group"
        >
          <div className="relative flex-1">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Envie uma mensagem..."
              disabled={isStreaming}
              className="pr-12 py-6 bg-background/50 border-border focus-visible:ring-primary/20 transition-all rounded-xl"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {!conversationId && messages.length > 0 && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-1" />
              )}
              <Button 
                type="submit" 
                size="icon" 
                disabled={!input.trim() || isStreaming}
                className="h-9 w-9 rounded-lg shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
              >
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
