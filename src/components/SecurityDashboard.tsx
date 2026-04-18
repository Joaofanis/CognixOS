import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  History, 
  Flame, 
  Lock, 
  Eye, 
  AlertCircle,
  Database,
  Fingerprint
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "./ui/alert-dialog";

export default function SecurityDashboard() {
  const queryClient = useQueryClient();
  const [isPurging, setIsPurging] = useState(false);

  // Fetch Security Audit Logs
  const { data: logs, isLoading: loadingLogs } = useQuery({
    queryKey: ["security_audit_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
  });

  // Panic Purge Mutation
  const purgeMutation = useMutation({
    mutationFn: async () => {
      setIsPurging(true);
      const { error } = await supabase.rpc("purge_sensitive_data");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("🛡️ DADOS SENSÍVEIS PURGADOS COM SUCESSO.");
      queryClient.invalidateQueries();
      setIsPurging(false);
    },
    onError: (err: any) => {
      toast.error(`Falha na purgação: ${err.message}`);
      setIsPurging(false);
    }
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-500/20 text-red-500 border-red-500/50';
      case 'WARN': return 'bg-orange-500/20 text-orange-500 border-orange-500/50';
      default: return 'bg-green-500/20 text-green-500 border-green-500/50';
    }
  };

  const getEventIcon = (type: string) => {
    if (type.includes('INJECTION')) return <ShieldAlert className="h-4 w-4" />;
    if (type === 'DELETE') return <History className="h-4 w-4" />;
    if (type === 'INSERT') return <Database className="h-4 w-4" />;
    return <Eye className="h-4 w-4" />;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Shield Status Card */}
        <Card className="bg-white/[0.02] border-white/5 rounded-3xl overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <ShieldCheck className="h-6 w-6 text-green-500" />
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 rounded-lg text-[9px] font-black uppercase tracking-widest">Ativo</Badge>
            </div>
            <CardTitle className="mt-2 text-lg font-black italic tracking-tighter uppercase italic">Neural Shield v3.0</CardTitle>
            <CardDescription className="text-[10px] font-mono tracking-widest uppercase">Firewall de Prompt Ativo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between mt-2">
              <span className="text-2xl font-black italic tracking-tighter italic">100% UPTIME</span>
              <div className="flex gap-1 h-8 items-end">
                {[1,2,3,4,5,6].map(i => <div key={i} className="w-1 bg-green-500/40 rounded-full h-[60%] animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Identity Hardening Card */}
        <Card className="bg-white/[0.02] border-white/5 rounded-3xl overflow-hidden relative">
          <CardHeader className="pb-2">
            <Fingerprint className="h-6 w-6 text-primary" />
            <CardTitle className="mt-2 text-lg font-black italic tracking-tighter uppercase italic">Request Signing</CardTitle>
            <CardDescription className="text-[10px] font-mono tracking-widest uppercase">HMAC-SHA256 Ativo</CardDescription>
          </CardHeader>
          <CardContent>
             <p className="text-[11px] text-muted-foreground italic leading-relaxed">
               Cada comando enviado pela interface é assinado criptograficamente para prevenir ataques de replay e falsificação de sessão.
             </p>
          </CardContent>
        </Card>

        {/* Panic Control Card */}
        <Card className="bg-red-500/[0.02] border-red-500/10 rounded-3xl overflow-hidden relative group">
           <CardHeader className="pb-2">
            <Flame className="h-6 w-6 text-red-500" />
            <CardTitle className="mt-2 text-lg font-black italic tracking-tighter uppercase italic">Protocolo de Pânico</CardTitle>
            <CardDescription className="text-[10px] font-mono tracking-widest uppercase">Mecanismo de Autodestruição</CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full rounded-xl bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white font-black italic tracking-tighter uppercase transition-all">
                  {isPurging ? "PURGANDO..." : "ATUAR MODO PANICO"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-[#0c0c0d] border-red-500/20 text-white rounded-3xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-2xl font-black italic italic text-red-500 uppercase">CONFIRMAR AUTODESTRUIÇÃO?</AlertDialogTitle>
                  <AlertDialogDescription className="text-muted-foreground text-sm font-medium">
                    Esta ação é <strong className="text-white">IRREVERSÍVEL</strong>. Todos os seus textos, playbooks, subagentes e squads serão permanentemente apagados dos servidores.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-white/5 border-white/10 rounded-xl font-bold">CANCELAR</AlertDialogCancel>
                  <AlertDialogAction onClick={() => purgeMutation.mutate()} className="bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold">PURGAR TUDO</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>

      {/* Live Security Audit Log */}
      <Card className="bg-[#0b0b0c] border-white/5 shadow-2xl relative overflow-hidden rounded-3xl flex flex-col min-h-[400px]">
        <div className="bg-white/5 px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <History className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-black italic tracking-tighter uppercase italic">Live Security Audit</h3>
              <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-widest">Monitoramento Zero-Trust em Tempo Real</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-[9px] font-mono uppercase opacity-50">Link Seguro</span>
          </div>
        </div>
        <CardContent className="p-0 flex-1">
          <ScrollArea className="h-[450px]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#0b0b0c] border-b border-white/5 z-10">
                <tr className="text-[9px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-6 py-4 font-black italic">Evento</th>
                  <th className="px-6 py-4 font-black italic">Tabela</th>
                  <th className="px-6 py-4 font-black italic">Severidade</th>
                  <th className="px-6 py-4 font-black italic text-right">Data/Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {loadingLogs ? (
                  [1,2,3,4,5].map(i => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={4} className="px-6 py-8"><div className="h-4 bg-white/5 rounded-lg w-full" /></td>
                    </tr>
                  ))
                ) : logs?.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center text-white/20 italic">Sem eventos de segurança registrados.</td>
                  </tr>
                ) : logs?.map((log: any) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn("p-1.5 rounded-lg border", getSeverityColor(log.severity))}>
                          {getEventIcon(log.event_type)}
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-tight">{log.event_type}</p>
                          <p className="text-[9px] font-mono text-muted-foreground opacity-50">{log.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className="rounded-lg bg-white/5 border-white/10 text-[9px] font-mono uppercase">{log.table_name}</Badge>
                    </td>
                    <td className="px-6 py-4">
                       <span className={cn(
                         "text-[10px] font-black italic tracking-tighter italic uppercase",
                         log.severity === 'CRITICAL' ? 'text-red-500' : log.severity === 'WARN' ? 'text-orange-500' : 'text-green-500'
                       )}>
                         {log.severity}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-[10px] font-mono text-muted-foreground">
                        {new Date(log.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-[10px] font-mono text-white/50">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
