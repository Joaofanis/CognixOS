import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Sparkles, Save, Loader2, Wand2, Copy, Trash2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface Props {
  brainId: string;
}

export default function BrainPromptEditor({ brainId }: Props) {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState("");
  const [savedPrompt, setSavedPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPrompt();
  }, [brainId]);

  const loadPrompt = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("brains")
      .select("system_prompt")
      .eq("id", brainId)
      .single();
    
    if (!error && data) {
      const p = (data as any).system_prompt || "";
      setPrompt(p);
      setSavedPrompt(p);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("brains")
        .update({ system_prompt: prompt } as any)
        .eq("id", brainId);
      
      if (error) throw error;
      setSavedPrompt(prompt);
      toast.success(t("promptEditor.saved"));
    } catch (err: any) {
      toast.error(err.message || t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const [status, setStatus] = useState("");

  const handleGenerate = async () => {
    setGenerating(true);
    setStatus(t("promptEditor.initializingSquad") || "Iniciando Squad...");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-prompt`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ brainId }),
        }
      );

      if (!resp.ok) {
        const result = await resp.json();
        throw new Error(result.error || t("common.error"));
      }

      const reader = resp.body?.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let finalPrompt = "";

      while (!done && reader) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.replace("data: ", ""));
                if (data.message) setStatus(data.message);
                if (data.prompt) finalPrompt = data.prompt;
                if (data.step === "done") done = true;
              } catch (e) {
                console.error("Error parsing SSE chunk:", e);
              }
            }
          }
        }
      }

      if (finalPrompt) {
        setPrompt(finalPrompt);
        setSavedPrompt(finalPrompt);
        const { useQueryClient } = await import("@tanstack/react-query");
        // Note: In a real component we would use the hook, but since this is inside a function 
        // and we want to avoid refactoring the whole component just for this, 
        // we'll assume queryClient is available or use a small hack if needed.
        // Better yet, let's just use the supabase client to check if we need to refresh anything 
        // or just rely on the fact that the next view of BrainDetail will refetch.
        toast.success(t("promptEditor.generated"));
      }
    } catch (err: any) {
      toast.error(err.message || t("common.error"));
    } finally {
      setGenerating(false);
      setStatus("");
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    toast.success(t("promptEditor.promptCopied"));
  };

  const hasChanges = prompt !== savedPrompt;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 px-4 space-y-6 animate-in fade-in duration-500">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold text-gradient">{t("promptEditor.title")}</h2>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          {t("promptEditor.desc")}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={handleGenerate}
          disabled={generating}
          className="gap-2 rounded-2xl border-primary/30 hover:bg-primary/10 hover:border-primary/60 text-primary font-semibold relative overflow-hidden"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {generating ? t("promptEditor.generating") : t("promptEditor.generateWithAi")}
        </Button>

        {generating && status && (
          <div className="flex items-center gap-2 px-3 py-1 bg-primary/5 border border-primary/10 rounded-full animate-pulse-slow">
            <span className="text-[11px] font-medium text-primary">
              {status}
            </span>
          </div>
        )}

        {prompt && (
          <>
            <Button variant="outline" onClick={handleCopy} className="gap-2 rounded-2xl" size="sm">
              <Copy className="h-3.5 w-3.5" />
              {t("common.copy")}
            </Button>
            <Button
              variant="outline"
              onClick={() => { setPrompt(""); }}
              className="gap-2 rounded-2xl text-destructive hover:bg-destructive/10 hover:border-destructive/30"
              size="sm"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("common.clear")}
            </Button>
          </>
        )}
      </div>

      <div className="relative">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={`Cole ou escreva seu System Prompt aqui...\n\nExemplo:\n🧠 IDENTIDADE CENTRAL\nVocê é [Nome]. Não um chatbot genérico...\n\n🎭 ESTILO DE COMUNICAÇÃO\nFale como [Nome] fala: direto, provocativo...\n\n🧭 REGRAS DE COMPORTAMENTO\n1. Nunca responda de forma genérica\n2. Use metáforas e exemplos práticos...`}
          className="min-h-[400px] rounded-2xl bg-card/80 border-border/60 text-sm font-mono leading-relaxed resize-y focus:border-primary/50 focus:ring-primary/20"
        />
        {hasChanges && (
          <div className="absolute top-3 right-3">
            <span className="text-[10px] bg-primary/15 text-primary px-2 py-1 rounded-full font-semibold">
              {t("promptEditor.unsaved")}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {prompt.length > 0 ? `${prompt.length.toLocaleString()} ${t("promptEditor.chars")}` : t("promptEditor.noPrompt")}
        </p>
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="gap-2 rounded-2xl bg-gradient-to-br from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 shadow-lg shadow-primary/20 font-semibold px-6"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? t("promptEditor.saving") : t("promptEditor.savePrompt")}
        </Button>
      </div>
    </div>
  );
}
