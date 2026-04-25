import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sparkles, Key, HardDrive, Database, ArrowRight, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [byokKey, setByokKey] = useState("");
  const [isSeeding, setIsSeeding] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Step 1: BYOK Configuration
  const handleSaveByok = async () => {
    if (!byokKey) {
      toast.error("Insira sua chave de API para continuar");
      return;
    }
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          ai_settings: { 
            active_provider: 'custom', 
            custom_openrouter_key: byokKey 
          } 
        })
        .eq('id', user?.id);
        
      if (error) throw error;
      toast.success("Chave salva com segurança!");
      setStep(2);
    } catch (err) {
      toast.error("Erro ao salvar chave BYOK");
    }
  };

  // Step 2: Seed Antigravity Kit
  const handleSeedDatabase = async () => {
    setIsSeeding(true);
    try {
      toast.loading("Inicializando Antigravity Kit...");
      
      const { data, error } = await supabase.functions.invoke("seed-database");
      
      if (error) throw error;
      
      toast.dismiss();
      toast.success(data?.message || "Esquadrão de elite inicializado com sucesso!");
      setStep(3);
    } catch (err) {
      toast.dismiss();
      toast.error("Erro ao popular o banco de dados");
      console.error(err);
    } finally {
      setIsSeeding(false);
    }
  };

  // Step 3: Finish
  const handleFinish = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xl space-y-8 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-violet-500/20 mb-6 border border-primary/20">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Bem-vindo ao CognixOS 6.0
          </h1>
          <p className="text-muted-foreground">
            Vamos configurar sua soberania de dados e agentes autônomos.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          <div className="absolute top-4 left-6 right-6 h-0.5 bg-border -z-10" />
          <div className="flex justify-between relative z-10 px-2">
            {[1, 2, 3].map((num) => (
              <div 
                key={num}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                  step >= num 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted text-muted-foreground border border-border"
                }`}
              >
                {step > num ? <CheckCircle2 className="h-4 w-4" /> : num}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <Card className="p-6 border-border/50 bg-card/50 backdrop-blur-xl shadow-2xl">
          
          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Soberania: Bring Your Own Key</h2>
                  <p className="text-sm text-muted-foreground">Você detém os créditos. Nenhuma assinatura externa.</p>
                </div>
              </div>
              <div className="space-y-3">
                <Input 
                  type="password"
                  placeholder="sk-or-v1-..."
                  value={byokKey}
                  onChange={(e) => setByokKey(e.target.value)}
                  className="font-mono text-sm h-12"
                />
                <p className="text-xs text-muted-foreground">
                  Obtenha sua chave no <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-primary hover:underline">OpenRouter</a>.
                </p>
              </div>
              <Button onClick={handleSaveByok} className="w-full gap-2 h-12">
                Salvar Chave <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Antigravity Kit (Squad Base)</h2>
                  <p className="text-sm text-muted-foreground">Instalar 20 agentes essenciais e 36 módulos de skills.</p>
                </div>
              </div>
              <div className="bg-muted/50 p-4 rounded-xl border border-border/50 space-y-2">
                <p className="text-sm font-medium">O que será criado no seu banco:</p>
                <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                  <li>Orchestrator, QA, Security Auditor, Frontend & Backend Devs...</li>
                  <li>Skills de Node.js, React, Tailwind, TDD e Design Database.</li>
                </ul>
              </div>
              <Button 
                onClick={handleSeedDatabase} 
                className="w-full gap-2 h-12"
                disabled={isSeeding}
              >
                {isSeeding ? "Populando banco..." : "Instalar e Continuar"}
                {!isSeeding && <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in slide-in-from-right-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10 text-green-500">
                  <HardDrive className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Tudo Pronto!</h2>
                  <p className="text-sm text-muted-foreground">Seu sistema operacional de IA está preparado.</p>
                </div>
              </div>
              <div className="bg-green-500/5 p-4 rounded-xl border border-green-500/20">
                <p className="text-sm text-green-500">
                  Você agora pode instanciar cérebros com templates de agentes,
                  usar ferramentas MCP na web e habilitar loops autônomos.
                </p>
              </div>
              <Button onClick={handleFinish} className="w-full gap-2 h-12 bg-green-600 hover:bg-green-700">
                Entrar no CognixOS 🚀
              </Button>
            </div>
          )}

        </Card>
      </div>
    </div>
  );
}
