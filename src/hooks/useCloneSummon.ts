import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Message } from "./useBrainChat";

const SUMMON_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/summon-clone`;
const UPDATE_PROFILE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user-profile`;

export interface SummonedMessage extends Message {
  cloneId: string;
  cloneName: string;
  cloneType?: string;
  isSummoned: true;
}

export interface SummonRequest {
  targetBrainId: string;
  reason: string;
  // If triggered by AI embed in response
  aiTriggered?: boolean;
}

// Regex to detect AI-requested summons in streamed output
// Format: <summon brain_id="UUID" reason="..."/>
const SUMMON_TAG_RE = /<summon\s+brain_id="([^"]+)"\s+reason="([^"]*)"\s*\/>/g;

export function useCloneSummon() {
  const [summonedMessages, setSummonedMessages] = useState<SummonedMessage[]>([]);
  const [isSummoning, setIsSummoning] = useState(false);
  const [pendingSummon, setPendingSummon] = useState<SummonRequest | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isRunningRef = useRef(false); // ref to prevent stale closure zombie streams

  /**
   * Scan streamed text for AI-triggered summon tags.
   * Returns the cleaned text (without summon tags) and any found summon requests.
   */
  const extractSummonTags = useCallback((text: string): { cleaned: string; requests: SummonRequest[] } => {
    const requests: SummonRequest[] = [];
    const cleaned = text.replace(SUMMON_TAG_RE, (_, brainId, reason) => {
      requests.push({ targetBrainId: brainId, reason, aiTriggered: true });
      return "";
    });
    return { cleaned, requests };
  }, []);

  /**
   * Actually calls the summon-clone edge function and streams the response
   * into summonedMessages.
   */
  const executeSummon = useCallback(async (
    request: SummonRequest,
    contextMessages: Message[],
    userProfileSummary?: string,
    mode?: "fast" | "thinking" | "default",
  ) => {
    if (isRunningRef.current) return; // use ref, not state, to prevent stale closure
    isRunningRef.current = true;
    setIsSummoning(true);
    setPendingSummon(null);

    const controller = new AbortController();
    abortRef.current = controller;

    // Look up clone name from brains if possible (we don't have it here, will fill in post)
    const cloneId = request.targetBrainId;

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const resp = await fetch(SUMMON_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          targetBrainId: cloneId,
          contextMessages: contextMessages.slice(-20),
          reason: request.reason,
          userProfileSummary,
          mode: mode || "default",
        }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({}));
        setSummonedMessages(prev => [...prev, {
          role: "assistant",
          content: `⚠️ Erro ao invocar clone: ${err.error || "falha desconhecida"}`,
          cloneId,
          cloneName: "Clone",
          isSummoned: true,
        }]);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      // Use a unique ID to correctly track this specific summon message during streaming
      const msgId = `${cloneId}-${Date.now()}`;
      setSummonedMessages(prev => [...prev, {
        role: "assistant",
        content: "",
        cloneId,
        cloneName: "Clone convocado",
        isSummoned: true,
        id: msgId,
      } as SummonedMessage & { id: string }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const jsonStr = trimmed.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const chunk = parsed.choices?.[0]?.delta?.content;
            if (chunk) {
              accumulated += chunk;
              setSummonedMessages(prev => {
                const newPrev = [...prev];
                // Find by unique msgId to prevent updating wrong clone message
                const targetIdx = newPrev.findIndex((m: any) => m.id === msgId);
                if (targetIdx !== -1) {
                  newPrev[targetIdx] = { ...newPrev[targetIdx], content: accumulated };
                }
                return newPrev;
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") return;
      setSummonedMessages(prev => [...prev, {
        role: "assistant",
        content: `⚠️ Erro ao invocar clone`,
        cloneId,
        cloneName: "Clone",
        isSummoned: true,
      }]);
    } finally {
      isRunningRef.current = false;
      setIsSummoning(false);
    }
  }, []); // stable ref — running state managed via isRunningRef

  /**
   * Update clone name on a summoned message once we know it.
   */
  const setCloneName = useCallback((cloneId: string, name: string, type?: string) => {
    setSummonedMessages(prev => prev.map(m =>
      m.cloneId === cloneId && m.isSummoned
        ? { ...m, cloneName: name, cloneType: type }
        : m
    ));
  }, []);

  /**
   * Fire-and-forget profile update (non-blocking).
   */
  const updateProfile = useCallback(async (messages: Message[]) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch(UPDATE_PROFILE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ recentMessages: messages.slice(-10) }),
      });
    } catch { /* silent */ }
  }, []);

  const stopSummon = useCallback(() => {
    abortRef.current?.abort();
    setIsSummoning(false);
  }, []);

  const resetSummoned = useCallback(() => {
    setSummonedMessages([]);
    setPendingSummon(null);
  }, []);

  return {
    summonedMessages,
    isSummoning,
    pendingSummon,
    setPendingSummon,
    executeSummon,
    extractSummonTags,
    setCloneName,
    updateProfile,
    stopSummon,
    resetSummoned,
  };
}
