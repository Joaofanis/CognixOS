import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AgentMessage {
  type:
    | "admin_thinking"
    | "squad_formed"
    | "iteration_start"
    | "agent_thinking"
    | "agent_response"
    | "admin_evaluation"
    | "synthesizing"
    | "synthesis_start"
    | "synthesis_token"
    | "done"
    | "error";
  // common
  message?: string;
  // squad_formed
  squad?: { id: string; name: string; type: string }[];
  reasoning?: string;
  strategy?: string;
  // iteration
  iteration?: number;
  maxIterations?: number;
  // agent_thinking / agent_response
  agentId?: string;
  agentName?: string;
  agentType?: string;
  content?: string;
  // admin_evaluation
  satisfied?: boolean;
  reason?: string;
  improvements_needed?: string;
  // done
  finalAnswer?: string;
}

const SQUAD_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-squad`;

interface UseAgentSquadProps {
  onDone?: (finalAnswer: string) => void;
}

export function useAgentSquad({ onDone }: UseAgentSquadProps = {}) {
  const [events, setEvents] = useState<AgentMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [finalAnswer, setFinalAnswer] = useState<string | null>(null);
  const [synthesisSoFar, setSynthesisSoFar] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const reset = () => {
    abortRef.current?.abort();
    setEvents([]);
    setFinalAnswer(null);
    setSynthesisSoFar("");
    setIsRunning(false);
  };

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
  }, []);

  const runSquad = useCallback(
    async (query: string, brainIds?: string[]) => {
      if (!query.trim() || isRunning) return;

      reset();
      setIsRunning(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const resp = await fetch(SQUAD_URL, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ query, brainIds }),
        });

        if (!resp.ok || !resp.body) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || "Erro ao conectar com o Squad");
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";
        let synthesis = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          textBuffer += decoder.decode(value, { stream: true });
          const lines = textBuffer.split("\n");
          textBuffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const jsonStr = trimmed.slice(6).trim();
            try {
              const event = JSON.parse(jsonStr) as AgentMessage;
              if (event.type === "synthesis_token") {
                synthesis += event.content || "";
                setSynthesisSoFar(synthesis);
              } else if (event.type === "done") {
                setFinalAnswer(event.finalAnswer || synthesis);
                onDone?.(event.finalAnswer || synthesis);
              } else {
                setEvents((prev) => [...prev, event]);
              }
            } catch {
              /* ignore */
            }
          }
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setEvents((prev) => [
          ...prev,
          { type: "error", message: err.message || "Falha no squad" },
        ]);
      } finally {
        setIsRunning(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isRunning, onDone],
  );

  return {
    events,
    isRunning,
    finalAnswer,
    synthesisSoFar,
    runSquad,
    reset,
    stop,
  };
}
