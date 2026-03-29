import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Save,
  Sparkles,
  Trash2,
  Wand2,
  Copy,
  Quote,
} from "lucide-react";
import { toast } from "sonner";
import TagInput from "@/components/TagInput";
import { BRAIN_TYPE_CONFIG, BrainType } from "@/lib/brain-types";
import QuotesDatabase from "@/components/QuotesDatabase";

interface Brain {
  id: string;
  name: string;
  description: string | null;
  type: string;
  tags?: string[] | null;
}

interface Props {
  brain: Brain;
}

export default function BrainSettings({ brain }: Props) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Identity fields
  const [name, setName] = useState(brain.name);
  const [description, setDescription] = useState(brain.description || "");
  const [tags, setTags] = useState<string[]>((brain.tags as string[]) || []);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);

  // Prompt fields
  const [prompt, setPrompt] = useState("");
  const [savedPrompt, setSavedPrompt] = useState("");
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [generatingPrompt, setGeneratingPrompt] = useState(false);

  // Delete
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const config = BRAIN_TYPE_CONFIG[brain.type as BrainType];
  const Icon = config?.icon;

  // ── Load prompt ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("brains")
        .select("system_prompt")
        .eq("id", brain.id)
        .single();
      const p = (data as any)?.system_prompt || "";
      setPrompt(p);
      setSavedPrompt(p);
      setLoadingPrompt(false);
    })();
  }, [brain.id]);

  // ── Sync if brain prop changes ─────────────────────────────────────────────
  useEffect(() => {
    setName(brain.name);
    setDescription(brain.description || "");
    setTags((brain.tags as string[]) || []);
  }, [brain]);

  // ── Identity save ──────────────────────────────────────────────────────────
  const handleSaveIdentity = async () => {
    if (!name.trim()) return;
    setSavingIdentity(true);
    try {
      const { error } = await supabase
        .from("brains")
        .update({
          name: name.trim(),
          description: description.trim() || null,
          tags,
          updated_at: new Date().toISOString(),
        })
        .eq("id", brain.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["brain", brain.id] });
      queryClient.invalidateQueries({ queryKey: ["brains"] });
      toast.success("Informações salvas!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingIdentity(false);
    }
  };

  const handleGenerateDesc = async () => {
    if (!name.trim()) return toast.error("Digite um nome primeiro");
    setGeneratingDesc(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke(
        "generate-description",
        {
          body: { name: name.trim(), type: brain.type, tags },
          headers: { Authorization: `Bearer ${session?.access_token}` },
        },
      );
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setDescription(data.description);
      toast.success("Descrição gerada!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar descrição");
    } finally {
      setGeneratingDesc(false);
    }
  };

  // ── Prompt save ────────────────────────────────────────────────────────────
  const [promptSteps, setPromptSteps] = useState<any[]>([]);
  const [promptRunning, setPromptRunning] = useState(false);

  const handleSavePrompt = async () => {
    setSavingPrompt(true);
    try {
      const { error } = await supabase
        .from("brains")
        .update({ system_prompt: prompt } as any)
        .eq("id", brain.id);
      if (error) throw error;
      setSavedPrompt(prompt);
      toast.success("Prompt salvo!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleGeneratePrompt = async () => {
    setGeneratingPrompt(true);
    setPromptSteps([]);
    setPromptRunning(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-prompt`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ brainId: brain.id }),
        },
      );
      
      if (!resp.ok) throw new Error("Erro ao gerar prompt");
      
      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No stream");
      const decoder = new TextDecoder();
      let buffer = "";

      let finalPrompt = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("

")) !== -1) {
          const chunk = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 2);

          if (!chunk.startsWith("data: ")) continue;
          const jsonStr = chunk.slice(6);
          try {
            const data = JSON.parse(jsonStr);
            setPromptSteps((prev) => [...prev, data]);
            
            if (data.step === "done" && data.prompt) {
               finalPrompt = data.prompt;
               setPrompt(data.prompt);
               toast.success("Prompt Operacional gerado do Squad!");
               queryClient.invalidateQueries({ queryKey: ["brain", brain.id] });
               setSavedPrompt(data.prompt);
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err: any) {
      toast.error(err.message);
      setPromptSteps((prev) => [...prev, { step: "error", message: err.message }]);
    } finally {
      setGeneratingPrompt(false);
      setPromptRunning(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("brains")
        .delete()
        .eq("id", brain.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["brains"] });
      toast.success("Cérebro deletado.");
      navigate("/");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
      setShowDelete(false);
    }
  };

  const hasIdentityChanges =
    name !== brain.name ||
    description !== (brain.description || "") ||
    JSON.stringify(tags) !== JSON.stringify((brain.tags as string[]) || []);

  const hasPromptChanges = prompt !== savedPrompt;

  return (
    <div className="container max-w-2xl py-8 px-4 space-y-8 animate-in fade-in duration-500">
      {/* ── Identity section ─────────────────────────────────────────────── */}
      <section className="space-y-5 rounded-2xl border border-border/60 bg-card/60 p-5">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          )}
          <div>
            <h3 className="font-bold text-foreground">Identidade</h3>
            <p className="text-xs text-muted-foreground">{config?.label}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="settings-name">Nome</Label>
            <Input
              id="settings-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do cérebro"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tags</Label>
            <TagInput
              tags={tags}
              onChange={setTags}
              placeholder="Ex: filosofia, coaching... (Enter)"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="settings-desc">Descrição</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGenerateDesc}
                disabled={generatingDesc || !name.trim()}
                className="h-6 text-xs gap-1 text-primary hover:bg-primary/8 rounded-lg px-2"
              >
                {generatingDesc ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Gerar com IA
              </Button>
            </div>
            <textarea
              id="settings-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva brevemente este cérebro..."
              rows={3}
              className="w-full resize-y rounded-xl border border-border/60 bg-background/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
        </div>

        <Button
          onClick={handleSaveIdentity}
          disabled={!name.trim() || savingIdentity || !hasIdentityChanges}
          className="gap-2 rounded-xl"
        >
          {savingIdentity ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar Informações
        </Button>
      </section>

      {/* ── Prompt section ───────────────────────────────────────────────── */}
      <section className="space-y-4 rounded-2xl border border-border/60 bg-card/60 p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-bold text-foreground">System Prompt</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Defina como a IA deve se comportar, falar e pensar. Deixe em branco
          para usar o padrão.
        </p>

        {loadingPrompt ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {promptSteps.length > 0 && (
              <div className="bg-muted/30 p-4 rounded-xl space-y-2 mb-4">
                <div className="flex items-center gap-2">
                  <Wand2 className={`h-4 w-4 text-primary ${promptRunning ? 'animate-pulse' : ''}`} />
                  <span className="font-semibold text-sm">Squad em Operação ⚡</span>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {promptSteps.map((s, i) => (
                    <div key={i} className={`text-xs p-1.5 rounded bg-background/50 border border-border/50 break-all 
                        ${s.step === 'error' ? 'text-destructive' : s.step === 'done' ? 'text-primary font-medium' : 'text-muted-foreground'}`
                    }>
                       <span className="font-bold">{s.agent ? `[${s.agent}] ` : ''}</span>
                       {s.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGeneratePrompt}
                disabled={generatingPrompt}
                className="gap-2 rounded-xl border-primary/30 hover:bg-primary/10 text-primary font-semibold"
              >
                {generatingPrompt ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" />
                )}
                {generatingPrompt ? "Gerando..." : "Gerar com IA"}
              </Button>
              {prompt && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 rounded-xl"
                    onClick={() => {
                      navigator.clipboard.writeText(prompt);
                      toast.success("Copiado!");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copiar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 rounded-xl text-destructive hover:bg-destructive/10"
                    onClick={() => setPrompt("")}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Limpar
                  </Button>
                </>
              )}
            </div>

            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={`Cole ou escreva seu System Prompt aqui...\n\nExemplo:\n🧠 Você é ${brain.name}. Responda sempre em português...\n\n🎭 ESTILO: direto, com exemplos práticos.\n\n🧭 REGRAS: nunca seja genérico.`}
                style={{ minHeight: 200, maxHeight: 500 }}
                className="w-full resize-y rounded-xl border border-border/60 bg-background/60 px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors leading-relaxed"
              />
              {hasPromptChanges && (
                <span className="absolute top-3 right-3 text-[10px] bg-primary/15 text-primary px-2 py-1 rounded-full font-semibold">
                  Não salvo
                </span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {prompt.length > 0
                  ? `${prompt.length.toLocaleString()} caracteres`
                  : "Nenhum prompt definido"}
              </p>
              <Button
                onClick={handleSavePrompt}
                disabled={savingPrompt || !hasPromptChanges}
                className="gap-2 rounded-xl bg-gradient-to-br from-primary to-violet-600 hover:opacity-90 shadow-lg shadow-primary/20 font-semibold"
              >
                {savingPrompt ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {savingPrompt ? "Salvando..." : "Salvar Prompt"}
              </Button>
            </div>
          </>
        )}
      </section>

      {/* ── Quotes Database (person_clone only) ────────────────────────── */}
      {brain.type === "person_clone" && (
        <section className="rounded-2xl border border-border/60 bg-card/60 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Quote className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-bold text-foreground">Frases &amp; Falas</h3>
              <p className="text-xs text-muted-foreground">
                Banco de expressões e frases características do clone — usadas
                para enriquecer o prompt
              </p>
            </div>
          </div>
          <QuotesDatabase brainId={brain.id} />
        </section>
      )}
      <section className="rounded-2xl border border-border/60 bg-card/60 p-5 space-y-3">
        <h3 className="font-bold text-foreground text-sm">
          Informações do Clone
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Tipo</p>
            <Badge variant="secondary" className="font-semibold text-xs">
              {config?.label || brain.type}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">ID</p>
            <code className="text-xs text-muted-foreground font-mono">
              {brain.id.substring(0, 8)}…
            </code>
          </div>
        </div>
      </section>

      {/* ── Danger zone ──────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 space-y-3">
        <h3 className="font-bold text-destructive text-sm">Zona Perigosa</h3>
        <p className="text-xs text-muted-foreground">
          Excluir este cérebro remove permanentemente todas as fontes, conversas
          e dados associados.
        </p>
        <Button
          variant="outline"
          className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive rounded-xl"
          onClick={() => setShowDelete(true)}
        >
          <Trash2 className="h-4 w-4" />
          Excluir Cérebro
        </Button>
      </section>

      {/* Delete dialog */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{brain.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os textos e conversas serão
              removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
