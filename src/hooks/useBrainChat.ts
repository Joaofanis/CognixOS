import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrainType } from "@/lib/brain-types";

export type Message = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/brain-chat`;

interface UseBrainChatProps {
  brainId: string;
  onAssistantMessage?: (content: string) => void;
  onStreamingStart?: () => void;
  onStreamingEnd?: () => void;
}

export function useBrainChat({
  brainId,
  onAssistantMessage,
  onStreamingStart,
  onStreamingEnd,
}: UseBrainChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const loadHistory = async (convId: string) => {
    const { data: msgs } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });

    if (msgs) {
      setMessages(msgs as Message[]);
      setConversationId(convId);
    }
  };

  const sendMessage = async (input: string) => {
    if (!input.trim() || isStreaming) return;

    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    onStreamingStart?.();

    try {
      // 1. Ensure conversation exists
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

      // 2. Save user message
      if (convId) {
        await supabase.from("messages").insert({
          conversation_id: convId,
          role: "user",
          content: userMsg.content,
        });
      }

      // 3. Call AI Function
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          brainId,
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao conectar com IA");
      }

      // 4. Handle Streaming
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let assistantSoFar = "";
      let textBuffer = "";

      const updateAssistantInState = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: assistantSoFar } : m,
            );
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
        onAssistantMessage?.(assistantSoFar);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        const lines = textBuffer.split("\n");
        // Keep the last partial line in the buffer
        textBuffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (
            !trimmed ||
            trimmed.startsWith(":") ||
            !trimmed.startsWith("data: ")
          )
            continue;

          const jsonStr = trimmed.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) updateAssistantInState(content);
          } catch (e) {
            console.error("Error parsing SSE line:", trimmed, e);
          }
        }
      }

      // 5. Save final assistant message
      if (convId && assistantSoFar) {
        await supabase.from("messages").insert({
          conversation_id: convId,
          role: "assistant",
          content: assistantSoFar,
        });
      }
    } catch (err: any) {
      const errorMessage = `\n\n⚠️ Erro: ${err.message || "Falha ao gerar resposta"}`;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: errorMessage },
      ]);
    } finally {
      setIsStreaming(false);
      onStreamingEnd?.();
    }
  };

  return {
    messages,
    setMessages,
    isStreaming,
    sendMessage,
    conversationId,
    loadHistory,
  };
}
