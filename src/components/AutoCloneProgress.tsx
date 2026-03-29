import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Zap, Check, X } from "lucide-react";

export interface AutoCloneStep {
  step: string;
  message: string;
  urls?: string[];
  brainId?: string;
  chars?: number;
  url?: string;
  agent?: string;
  score?: number;
  approved?: boolean;
}

interface AutoCloneProgressProps {
  steps: AutoCloneStep[];
  isRunning: boolean;
  onDone: (brainId: string) => void;
}

export function AutoCloneProgress({
  steps,
  isRunning,
  onDone,
}: AutoCloneProgressProps) {
  const lastStep = steps[steps.length - 1];
  const doneStep = steps.find((s) => s.step === "done");
  const errorStep = steps.find((s) => s.step === "error");

  // Calculate progress based on agent phases (Now supporting 7 agents)
  const progressMap: Record<string, number> = {
    controller_start: 5,
    agent_researcher: 12,
    agent_researcher_extract: 20,
    agent_researcher_done: 25,
    agent_analyst: 35,
    agent_analyst_done: 45,
    agent_psycho: 50,
    agent_psycho_done: 55,
    agent_linguist: 60,
    agent_linguist_done: 65,
    agent_strategist: 70,
    agent_strategist_done: 78,
    agent_verifier: 82,
    agent_verifier_done: 88,
    saving: 92,
    agent_prompter: 94,
    agent_prompter_done: 96,
    prompt_done: 98,
    done: 100,
    error: 0,
  };
  const progress = progressMap[lastStep?.step || ""] || 0;

  // Get current agent name
  const currentAgent = lastStep?.agent || "";

  const ALL_AGENTS = [
    { id: "Pesquisador", label: "Pesquisador" },
    { id: "Analista", label: "Analista" },
    { id: "Psicanalista", label: "Psicanalista" },
    { id: "Linguista", label: "Linguista" },
    { id: "Estrategista", label: "Estrategista" },
    { id: "Verificador", label: "Verificador" },
    { id: "Prompter", label: "Prompter" },
  ];

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Zap className="h-8 w-8 text-primary" />
          {isRunning && (
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary animate-pulse" />
          )}
        </div>
        <div>
          <h3 className="font-semibold text-sm">
            Squad de Clonagem Digital 5.0
          </h3>
          <p className="text-xs text-muted-foreground">
            {isRunning
              ? currentAgent
                ? `Agente ${currentAgent} ativo...`
                : "Inicializando squad de elite..."
              : doneStep
                ? "Clone de alta fidelidade criado!"
                : errorStep
                  ? "Erro no processo"
                  : "Aguardando..."}
          </p>
        </div>
      </div>

      {/* Agent indicators */}
      {isRunning && (
        <div className="flex gap-1.5 flex-wrap">
          {ALL_AGENTS.map((ag) => {
            const isActive = currentAgent === ag.id;
            const isDone = steps.some(
              (s) =>
                s.agent === ag.id &&
                (s.step?.includes("_done") || s.step === "prompt_done"),
            );
            return (
              <span
                key={ag.id}
                className={`text-[9px] px-2 py-0.5 rounded-full font-medium transition-all duration-300 ${
                  isDone
                    ? "bg-primary/20 text-primary border border-primary/20"
                    : isActive
                      ? "bg-primary/10 text-primary animate-pulse ring-1 ring-primary/30"
                      : "bg-muted text-muted-foreground/60"
                }`}
              >
                {isDone ? "✓ " : isActive ? "● " : ""}
                {ag.label}
              </span>
            );
          })}
        </div>
      )}

      <Progress value={progress} className="h-2" />

      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
        {steps.map((s, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 text-[11px] rounded-lg px-3 py-1.5 transition-colors ${
              s.step === "error"
                ? "bg-destructive/10 text-destructive"
                : s.step === "done"
                  ? "bg-primary/15 text-primary font-semibold"
                  : "bg-muted/40 text-muted-foreground"
            }`}
          >
            {s.step === "done" ? (
              <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            ) : s.step === "error" ? (
              <X className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            ) : (
              <span className="h-3.5 w-3.5 mt-0.5 shrink-0 text-center">•</span>
            )}
            <span className="break-all">{s.message}</span>
          </div>
        ))}
      </div>

      {doneStep?.brainId && (
        <Button
          onClick={() => onDone(doneStep.brainId!)}
          className="w-full gap-2 gradient-jewel text-white font-semibold rounded-xl animate-in fade-in zoom-in duration-500"
        >
          <Check className="h-4 w-4" />
          Abrir Clone Criado
        </Button>
      )}

      {errorStep && !doneStep && (
        <p className="text-xs text-destructive text-center font-medium">
          Tente novamente ou crie manualmente.
        </p>
      )}
    </div>
  );
}
