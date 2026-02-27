import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Brain, Home, ArrowLeft, Sparkles } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-mesh bg-background relative flex items-center justify-center p-4 overflow-hidden">
      {/* Ambient orbs */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-60 -left-40 w-[400px] h-[400px] bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-0 w-[350px] h-[350px] bg-accent/8 rounded-full blur-3xl" />
      </div>

      <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 relative max-w-md">
        {/* Glowing 404 */}
        <div className="relative inline-block">
          <div className="text-[120px] font-black leading-none tracking-tighter text-gradient opacity-20 select-none">
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20 flex items-center justify-center shadow-2xl shadow-primary/20 pulse-ring">
                <Brain className="h-12 w-12 text-primary" />
              </div>
              <div className="absolute -top-1 -right-1 h-6 w-6 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center shadow-lg animate-bounce">
                <Sparkles className="h-3 w-3 text-white" />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-extrabold tracking-tight">
            Página não encontrada
          </h1>
          <p className="text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Este caminho não existe no seu segundo cérebro. Que tal voltar para o início?
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
            className="gap-2 rounded-2xl border-border/60 hover:border-primary/40 hover:bg-primary/5 font-semibold"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <Button
            onClick={() => navigate("/")}
            className="gap-2 rounded-2xl gradient-jewel text-white font-bold shadow-lg shadow-primary/25 hover:opacity-90 active:scale-[0.98] transition-all"
          >
            <Home className="h-4 w-4" />
            Ir para o início
          </Button>
        </div>
      </div>
    </div>
  );
}
