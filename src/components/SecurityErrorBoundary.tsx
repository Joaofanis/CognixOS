import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "./ui/button";
import { ShieldAlert, RefreshCcw, Home } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  errorID: string;
}

/**
 * Protocol Delta: Iron Shield (Global Error Boundary)
 * Capsulizes app-level failures to prevent data leaks or raw trace exposure.
 */
class SecurityErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorID: "",
  };

  public static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, errorID: (Math.random() * 1000000000).toString(16) };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error securely on the server/console, but never show it to the user.
    console.error("[Security Error Boundary] Critical Failure Caught:", error);
    console.error("[Security Error Boundary] Metadata:", errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#070708] flex flex-col items-center justify-center p-8 text-center text-white">
          <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mb-8 border-2 border-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.1)]">
            <ShieldAlert className="h-10 w-10 text-red-500" />
          </div>
          
          <h1 className="text-4xl font-black italic tracking-tighter mb-4 italic uppercase">NÚCLEO DE SEGURANÇA ATIVADO</h1>
          <p className="text-muted-foreground max-w-md mb-8 text-sm leading-relaxed font-medium">
            Uma falha crítica foi detectada e isolada pelos protocolos de segurança. 
            Todos os logs técnicos foram protegidos para evitar exposição de dados.
          </p>

          <div className="p-4 bg-white/5 border border-white/5 rounded-2xl mb-10 w-full max-w-xs font-mono text-[10px] text-white/30 uppercase tracking-widest">
            Protocolo: FAIL-SAFE-DELTA<br/>
            Ref ID: {this.state.errorID}<br/>
            Status: ISOLADO
          </div>

          <div className="flex gap-4">
            <Button onClick={() => window.location.reload()} className="gap-2 rounded-xl px-12 font-bold bg-white/5 hover:bg-white/10 text-white border border-white/10">
              <RefreshCcw className="h-4 w-4" /> TENTAR NOVAMENTE
            </Button>
            <Button onClick={() => window.location.href = '/'} variant="outline" className="gap-2 rounded-xl px-12 font-bold bg-primary text-white hover:bg-primary/90 border-0">
              <Home className="h-4 w-4" /> VOLTAR AO INÍCIO
            </Button>
          </div>

          <p className="mt-20 text-[9px] font-mono text-white/10 uppercase tracking-[0.5em]">
            AIOS Industrial Defense System v2.0
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default SecurityErrorBoundary;
