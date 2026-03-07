import { useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import ObsidianMarkdown from "@/components/ObsidianMarkdown";
import type { AgentMessage } from "@/hooks/useAgentSquad";
import {
  Bot,
  Brain,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Users,
  AlertTriangle,
  ChevronRight,
  Loader2,
  Square,
} from "lucide-react";

interface Props {
  events: AgentMessage[];
  isRunning: boolean;
  finalAnswer: string | null;
  synthesisSoFar: string;
  stop: () => void;
  onReset: () => void;
}

const BRAIN_TYPE_COLORS: Record<string, string> = {
  person_clone: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  knowledge_base: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  philosophy: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  practical_guide: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

export default function AgentSquadView({
  events,
  isRunning,
  finalAnswer,
  synthesisSoFar,
  stop,
  onReset,
}: Props) {
  const scrollRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events, synthesisSoFar]);

  const squadFormedEvent = events.find((e) => e.type === "squad_formed");
  const squadMembers = squadFormedEvent?.squad || [];

  // Collect response events grouped by iteration
  const responseEvents = events.filter((e) => e.type === "agent_response");
  const evalEvents = events.filter((e) => e.type === "admin_evaluation");

  const showSynthesis = synthesisSoFar || finalAnswer;

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)] bg-background">
      {/* Squad header */}
      {squadMembers.length > 0 && (
        <div className="border-b border-border/40 bg-card/40 px-4 py-2.5">
          <div className="max-w-3xl mx-auto flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />
              Squad:
            </span>
            {squadMembers.map((m) => (
              <Badge
                key={m.id}
                variant="outline"
                className={`text-[10px] font-semibold px-2 py-0.5 ${BRAIN_TYPE_COLORS[m.type] || "bg-primary/10 text-primary border-primary/20"}`}
              >
                {m.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Events stream */}
      <ScrollArea ref={scrollRef as any} className="flex-1">
        <div className="py-4 space-y-3 max-w-3xl mx-auto px-3 sm:px-4">
          {/* Admin thinking */}
          {events.some((e) => e.type === "admin_thinking") && (
            <div className="flex items-start gap-3 animate-in fade-in duration-300">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20 mt-0.5">
                <Brain className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-primary/80 mb-0.5">
                  Agente Administrador
                </p>
                <p className="text-sm text-muted-foreground">
                  Analisando a query e selecionando o squad ideal...
                </p>
              </div>
            </div>
          )}

          {/* Squad formed */}
          {squadFormedEvent && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 animate-in fade-in duration-300">
              <div className="flex items-center gap-2 mb-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-primary">
                  Squad Formado
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {squadFormedEvent.reasoning}
              </p>
              {squadFormedEvent.strategy && (
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-semibold">Estratégia:</span>{" "}
                  {squadFormedEvent.strategy}
                </p>
              )}
            </div>
          )}

          {/* Agent responses by iteration */}
          {events
            .filter((e) => e.type === "iteration_start")
            .map((iterEvent) => {
              const iter = iterEvent.iteration!;
              const iterResponses = responseEvents.filter(
                (r) => r.iteration === iter,
              );
              const iterEval = evalEvents.find((e) => e.iteration === iter);

              return (
                <div key={iter} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-border/50" />
                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider px-2">
                      Rodada {iter}
                    </span>
                    <div className="flex-1 h-px bg-border/50" />
                  </div>

                  {iterResponses.map((r, idx) => (
                    <div
                      key={idx}
                      className="group rounded-xl border border-border/50 bg-card/60 p-3 animate-in fade-in duration-300"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold ${BRAIN_TYPE_COLORS[r.agentType || ""] || "bg-muted border-border text-foreground"}`}
                        >
                          <Bot className="h-3 w-3" />
                        </div>
                        <span className="text-xs font-bold">{r.agentName}</span>
                        {r.agentType && (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 h-4 opacity-60"
                          >
                            {r.agentType}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-foreground/90 leading-relaxed">
                        <ObsidianMarkdown content={r.content || ""} />
                      </div>
                    </div>
                  ))}

                  {/* Admin eval */}
                  {iterEval && (
                    <div
                      className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-xs ${
                        iterEval.satisfied
                          ? "bg-emerald-500/10 border border-emerald-500/20"
                          : "bg-amber-500/10 border border-amber-500/20"
                      }`}
                    >
                      <Brain
                        className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${
                          iterEval.satisfied
                            ? "text-emerald-400"
                            : "text-amber-400"
                        }`}
                      />
                      <div>
                        <span className="font-bold">
                          {iterEval.satisfied
                            ? "✓ Resposta satisfatória"
                            : "↻ Refinando..."}
                        </span>
                        {iterEval.reason && (
                          <p className="text-muted-foreground mt-0.5">
                            {iterEval.reason}
                          </p>
                        )}
                        {!iterEval.satisfied &&
                          iterEval.improvements_needed && (
                            <p className="text-muted-foreground/80 mt-0.5 italic">
                              Melhorias: {iterEval.improvements_needed}
                            </p>
                          )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

          {/* Thinking agents (no response yet) */}
          {events
            .filter((e) => e.type === "agent_thinking")
            .filter(
              (e) =>
                !responseEvents.some(
                  (r) => r.agentId === e.agentId && r.iteration === e.iteration,
                ),
            )
            .slice(-1)
            .map((e, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 animate-in fade-in duration-300"
              >
                <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                <span className="text-xs text-muted-foreground">
                  {e.agentName} está pensando...
                </span>
              </div>
            ))}

          {/* Synthesizing */}
          {events.some(
            (e) => e.type === "synthesizing" || e.type === "synthesis_start",
          ) &&
            !finalAnswer && (
              <div className="flex items-center gap-2 animate-in fade-in duration-300">
                <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
                <span className="text-xs text-muted-foreground">
                  Sintetizando resposta final...
                </span>
              </div>
            )}

          {/* Error */}
          {events.some((e) => e.type === "error") && (
            <div className="flex items-center gap-2 text-destructive text-xs">
              <AlertTriangle className="h-3.5 w-3.5" />
              {events.find((e) => e.type === "error")?.message}
            </div>
          )}

          {/* Final synthesis */}
          {showSynthesis && (
            <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/5 to-accent/5 p-4 animate-in fade-in duration-500 space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 border border-primary/20">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-sm font-bold text-primary">
                  Resposta Final do Squad
                </span>
                {finalAnswer && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 ml-auto" />
                )}
              </div>
              <div className="text-[15px] leading-7 text-foreground">
                <ObsidianMarkdown
                  content={synthesisSoFar || finalAnswer || ""}
                />
              </div>
            </div>
          )}

          {/* Running indicator */}
          {isRunning && !showSynthesis && (
            <div className="flex gap-1.5 items-center pl-1 py-2">
              <span className="h-2 w-2 bg-primary/60 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="h-2 w-2 bg-primary/40 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="h-2 w-2 bg-primary/20 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer controls */}
      {(isRunning || finalAnswer) && (
        <div className="border-t border-border/40 bg-card/60 backdrop-blur-xl px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center gap-2">
            {isRunning ? (
              <Button
                variant="outline"
                size="sm"
                onClick={stop}
                className="gap-1.5 rounded-xl border-destructive/40 hover:bg-destructive/10 text-destructive"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                Parar Squad
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={onReset}
                className="gap-1.5 rounded-xl"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Nova Sessão
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
