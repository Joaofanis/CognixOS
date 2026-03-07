import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  Plus,
  Trash2,
  Quote,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface Quote {
  id: string;
  quote: string;
  context: string | null;
  source_text_id: string | null;
  created_at: string;
}

interface Props {
  brainId: string;
}

export default function QuotesDatabase({ brainId }: Props) {
  const queryClient = useQueryClient();
  const [newQuote, setNewQuote] = useState("");
  const [newContext, setNewContext] = useState("");
  const [adding, setAdding] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: quotes, isLoading } = useQuery({
    queryKey: ["brain-quotes", brainId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brain_quotes")
        .select("*")
        .eq("brain_id", brainId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Quote[];
    },
  });

  // Group quotes by context
  const grouped = quotes?.reduce(
    (acc, q) => {
      const key = q.context || "Geral";
      if (!acc[key]) acc[key] = [];
      acc[key].push(q);
      return acc;
    },
    {} as Record<string, Quote[]>,
  );

  const addQuote = async () => {
    if (!newQuote.trim()) return;
    setAdding(true);
    try {
      const { error } = await (supabase as any).from("brain_quotes").insert({
        brain_id: brainId,
        quote: newQuote.trim(),
        context: newContext.trim() || null,
      });
      if (error) throw error;
      setNewQuote("");
      setNewContext("");
      queryClient.invalidateQueries({ queryKey: ["brain-quotes", brainId] });
      toast.success("Frase adicionada!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  };

  const extractQuotes = async () => {
    setExtracting(true);
    toast.info("Extraindo frases características com IA...");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-quotes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ brainId }),
        },
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Erro ao extrair frases");
      queryClient.invalidateQueries({ queryKey: ["brain-quotes", brainId] });
      toast.success(
        `${data.extracted} frases extraídas de ${data.total} textos!`,
      );
    } catch (err: any) {
      toast.error(err.message || "Erro ao extrair frases");
    } finally {
      setExtracting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await (supabase as any)
        .from("brain_quotes")
        .delete()
        .eq("id", deleteTarget);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["brain-quotes", brainId] });
      toast.success("Frase removida");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Quote className="h-4 w-4 text-primary" />
            Banco de Falas e Frases
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {quotes?.length || 0} frases características capturadas
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs"
          onClick={extractQuotes}
          disabled={extracting}
        >
          {extracting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Extrair com IA
        </Button>
      </div>

      {/* Add quote form */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <p className="text-xs text-muted-foreground font-medium">
            Adicionar frase manualmente
          </p>
          <textarea
            placeholder="Cole aqui uma frase marcante, expressão característica ou fala típica..."
            value={newQuote}
            onChange={(e) => setNewQuote(e.target.value)}
            className="w-full rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors resize-none"
            style={{ minHeight: 72 }}
          />
          <div className="flex gap-2">
            <Input
              placeholder="Contexto (ex: liderança, humor...)"
              value={newContext}
              onChange={(e) => setNewContext(e.target.value)}
              className="text-sm rounded-xl flex-1"
            />
            <Button
              onClick={addQuote}
              disabled={!newQuote.trim() || adding}
              size="sm"
              className="gap-1.5 shrink-0"
            >
              {adding ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quotes list */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          Carregando frases...
        </div>
      ) : !quotes || quotes.length === 0 ? (
        <div className="text-center py-10 space-y-3">
          <Quote className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Nenhuma frase ainda
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Clique em "Extrair com IA" ou adicione manualmente
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={extractQuotes}
            disabled={extracting}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Extrair frases com IA
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped || {}).map(([context, contextQuotes]) => (
            <div key={context}>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                <span className="h-px flex-1 bg-border" />
                {context}
                <span className="h-px flex-1 bg-border" />
              </h4>
              <div className="space-y-2">
                {contextQuotes.map((q) => (
                  <div
                    key={q.id}
                    className="group relative flex gap-3 items-start p-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors"
                  >
                    <Quote className="h-3.5 w-3.5 text-primary/50 shrink-0 mt-0.5" />
                    <p className="text-sm flex-1 leading-relaxed italic">
                      "{q.quote}"
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteTarget(q.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    {q.source_text_id === null && (
                      <Badge
                        variant="outline"
                        className="text-[9px] absolute top-1.5 right-8 shrink-0"
                      >
                        manual
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover frase?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta frase será removida permanentemente do banco.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90 text-white gap-2"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
