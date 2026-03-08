import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ChatMode, Message } from "./useBrainChat";

const GENERAL_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/general-chat`;

export type { ChatMode, Message };

export function useGeneralChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeBrainId, setActiveBrainId] = useState<string | null>(null);
  const [activeBrainName, setActiveBrainName] = useState<string>("Assistente Geral");

  const abortControllerRef = useRef<AbortController | null>(null);

  const resetChat = () => {
    abortControllerRef.current?.abort();
    setMessages([]);
    setIsStreaming(false);
  };

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(
    async (input: string, mode: ChatMode = "default") => {
      if (!input.trim() || isStreaming) return;

      const userMsg: Message = { role: "user", content: input.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const { data: { session } } = await supabase.auth.getSession();

        const resp = await fetch(GENERAL_CHAT_URL, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            // Never send activeBrainId — general chat is always without a brain
            mode,
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

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let assistantSoFar = "";
        let textBuffer = "";

        const updateAssistant = (chunk: string) => {
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
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });
          const lines = textBuffer.split("\n");
          textBuffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(":") || !trimmed.startsWith("data: ")) continue;
            const jsonStr = trimmed.slice(6).trim();
            if (jsonStr === "[DONE]") break;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) updateAssistant(content);
            } catch {/* ignore */}
          }
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `\n\n⚠️ Erro: ${err.message || "Falha ao gerar resposta"}` },
        ]);
      } finally {
        setIsStreaming(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeBrainId, isStreaming, messages],
  );

  /** Add a summoned clone response inline into the messages array */
  const addSummonedResponse = useCallback((cloneName: string, content: string) => {
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: `**🔮 ${cloneName} (Convocado):**\n\n${content}` },
    ]);
  }, []);

  return {
    messages,
    setMessages,
    isStreaming,
    activeBrainId,
    activeBrainName,
    setActiveBrainId,
    setActiveBrainName,
    sendMessage,
    stopStreaming,
    resetChat,
    addSummonedResponse,
  };
}
