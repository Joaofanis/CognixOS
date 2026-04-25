import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plug } from "lucide-react";
import McpRegistryPanel from "@/components/McpRegistryPanel";

export default function McpHub() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl py-8 px-4 space-y-6 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="h-9 w-9 p-0 rounded-xl"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-violet-500/20">
                <Plug className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">MCP Hub</h1>
                <p className="text-xs text-muted-foreground">
                  Gerencie todas as integrações MCP do seu sistema
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm text-foreground font-medium mb-1">
            🔌 O que são MCPs?
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong>Model Context Protocol</strong> é o padrão aberto para conectar IAs a ferramentas e dados externos.
            Aqui você pode registrar servidores MCP (NotebookLM, n8n, APIs custom) e depois 
            vinculá-los aos seus cérebros para dar superpoderes aos seus clones.
          </p>
          <div className="flex gap-3 mt-3">
            <div className="text-center">
              <span className="text-lg">📚</span>
              <p className="text-[10px] text-muted-foreground">Conhecimento</p>
            </div>
            <div className="text-center">
              <span className="text-lg">⚡</span>
              <p className="text-[10px] text-muted-foreground">Execução</p>
            </div>
            <div className="text-center">
              <span className="text-lg">🤖</span>
              <p className="text-[10px] text-muted-foreground">Automação</p>
            </div>
            <div className="text-center">
              <span className="text-lg">🎨</span>
              <p className="text-[10px] text-muted-foreground">Criativo</p>
            </div>
          </div>
        </div>

        {/* Registry Panel */}
        <section className="rounded-2xl border border-border/60 bg-card/60 p-5">
          <McpRegistryPanel />
        </section>
      </div>
    </div>
  );
}
