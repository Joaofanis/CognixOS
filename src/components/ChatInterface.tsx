import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrainType } from "@/lib/brain-types";
import { Send, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Props {
  brainId: string;
  brainType: BrainType;
  brainName: string;
}

type Message = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/brain-chat`;

export default function ChatInterface({ brainId, brainType, brainName }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Load or create conversation
  useEffect(() => {
    const loadConversation = async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id")
        .eq("brain_id", brainId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setConversationId(data.id);
        // Load messages
        const { data: msgs } = await supabase
          .from("messages")
          .select("role, content")
          .eq("conversation_id", data.id)
          .order("created_at", { ascending: true });
        if (msgs) setMessages(msgs as Message[]);
      }
    };
    loadConversation();
  }, [brainId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || isStreaming) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    setInput("");
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);

    // Ensure conversation exists
    let convId = conversationId;
    if (!convId) {
      const { data } = await supabase
        .from("conversations")
        .insert({ brain_id: brainId, title: userMsg.content.slice(0, 50) })
        .select("id")
        .single();
      if (data) {
        convId = data.id;
        setConversationId(data.id);
      }
    }

    // Save user message
    if (convId) {
      await supabase.from("messages").insert({
        conversation_id: convId,
        role: "user",
        content: userMsg.content,
      });
    }

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          brainId,
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao conectar com IA");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Save assistant message
      if (convId && assistantSoFar) {
        await supabase.from("messages").insert({
          conversation_id: convId,
          role: "assistant",
          content: assistantSoFar,
        });
      }
    } catch (err: any) {
      upsertAssistant("\n\n⚠️ Erro: " + (err.message || "Falha ao gerar resposta"));
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)]">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium mb-1">Converse com {brainName}</p>
            <p className="text-sm">Envie uma mensagem para começar</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-muted rounded-bl-md"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t bg-card p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="container flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua mensagem..."
            disabled={isStreaming}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!input.trim() || isStreaming}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
