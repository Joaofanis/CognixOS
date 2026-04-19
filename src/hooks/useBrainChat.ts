import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateSecuritySignature } from "@/lib/security";

export type Message = { role: "user" | "assistant"; content: string };
export type ChatMode = "fast" | "thinking" | "default";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/brain-chat`;

interface UseBrainChatProps {
  brainId: string;
  mode?: ChatMode;
  onAssistantMessage?: (content: string) => void;
  onStreamingStart?: () => void;
  onStreamingEnd?: () => void;
  onConversationCreated?: (convId: string) => void;
}

export function useBrainChat({
  brainId,
  mode = "default",
  onAssistantMessage,
  onStreamingStart,
  onStreamingEnd,
  onConversationCreated,
}: UseBrainChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const lastUserInputRef = useRef<string>("");
  const conversationIdRef = useRef<string | null>(null);
  conversationIdRef.current = conversationId;

  // AbortController ref — allows cancelling the active stream
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadHistory = async (convId: string) => {
    setMessages([]);
    setConversationId(convId);
    const { data: msgs } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    if (msgs) setMessages(msgs as Message[]);
  };

  const resetChat = () => {
    // Cancel any in-progress stream
    abortControllerRef.current?.abort();
    setMessages([]);
    setConversationId(null);
    setIsStreaming(false);
  };

  /** Cancel an active stream and mark the partial response as complete */
  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    onStreamingEnd?.();
  }, [onStreamingEnd]);

  const sendMessage = useCallback(async (input: string, overrideMode?: ChatMode) => {
    if (!input.trim() || isStreaming) return;

    const currentMode = overrideMode || mode;
    lastUserInputRef.current = input.trim();
    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    onStreamingStart?.();

    // Create a fresh AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      let convId = conversationIdRef.current;
      if (!convId) {
        const { data, error: insertErr } = await supabase
          .from("conversations")
          .insert({ brain_id: brainId, title: userMsg.content.slice(0, 50) })
          .select("id")
          .single();
        if (insertErr) throw new Error(`Falha ao criar conversa: ${insertErr.message}`);
        if (data) {
          convId = data.id;
          setConversationId(data.id);
          onConversationCreated?.(data.id);
        }
      }

      if (convId) {
        await supabase.from("messages").insert({
          conversation_id: convId,
          role: "user",
          content: userMsg.content,
        });
      }

      const { data: { session } } = await supabase.auth.getSession();

      const payloadMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // --- Protocol Eta Signing ---
      const timestamp = Date.now();
      const signature = await generateSecuritySignature(JSON.stringify(payloadMessages), timestamp);

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          "X-AIOS-Signature": signature,
          "X-AIOS-Timestamp": timestamp.toString(),
        },
        body: JSON.stringify({
          brainId,
          mode: currentMode,
          messages: payloadMessages,
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
        textBuffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":") || !trimmed.startsWith("data: ")) continue;
          const jsonStr = trimmed.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) updateAssistantInState(content);
          } catch (e) {
            console.error("Error parsing SSE:", trimmed, e);
          }
        }
      }

      // Save assistant response to DB
      if (convId && assistantSoFar) {
        await supabase.from("messages").insert({
          conversation_id: convId,
          role: "assistant",
          content: assistantSoFar,
        });
      }
    } catch (err: any) {
      // Ignore abort errors — user cancelled intentionally
      if (err?.name === "AbortError") return;

      const errorMessage = `\n\n⚠️ Erro: ${err.message || "Falha ao gerar resposta"}`;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: errorMessage },
      ]);
    } finally {
      setIsStreaming(false);
      onStreamingEnd?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brainId, isStreaming, messages, onAssistantMessage, onStreamingStart, onStreamingEnd, onConversationCreated]);

  // Keep sendMessageRef fresh to avoid stale closures in retry
  const sendMessageRef = useRef(sendMessage);
  sendMessageRef.current = sendMessage;

  const retry = useCallback(() => {
    setMessages((prev) => {
      const withoutError = prev.filter((_, i) => i !== prev.length - 1);
      let lastUserIdx = -1;
      for (let i = withoutError.length - 1; i >= 0; i--) {
        if (withoutError[i].role === "user") { lastUserIdx = i; break; }
      }
      if (lastUserIdx >= 0) return withoutError.filter((_, i) => i !== lastUserIdx);
      return withoutError;
    });
    if (lastUserInputRef.current) {
      setTimeout(() => sendMessageRef.current(lastUserInputRef.current), 100);
    }
  }, []);

  return {
    messages,
    setMessages,
    isStreaming,
    sendMessage,
    stopStreaming,
    conversationId,
    loadHistory,
    resetChat,
    retry,
  };
}
