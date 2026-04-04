import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Factory } from "lucide-react";

export default function FactoryLine() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 flex flex-col items-center justify-center">
      <div className="max-w-4xl w-full space-y-8 text-center animate-pulse">
        <Factory className="h-24 w-24 mx-auto text-primary opacity-20" />
        <h1 className="text-4xl font-black italic tracking-tighter">AIOS FACTORY LINE</h1>
        <p className="text-muted-foreground uppercase tracking-widest text-xs">Produção em andamento...</p>
        <Button onClick={() => navigate("/")} variant="ghost" className="mt-8">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Painel
        </Button>
      </div>
    </div>
  );
}
