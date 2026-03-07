import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BRAIN_TYPE_CONFIG, BrainType } from "@/lib/brain-types";
import {
  Loader2,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Upload,
  Plus,
  Check,
  SkipForward,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import TagInput from "@/components/TagInput";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEPS = [
  { id: 1, label: "Identidade" },
  { id: 2, label: "Base" },
  { id: 3, label: "Prompt" },
];

export default function CreateBrainDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Step
  const [step, setStep] = useState(1);

  // Step 1 — Identity
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [type, setType] = useState<BrainType>("person_clone");
  const [generatingDesc, setGeneratingDesc] = useState(false);

  // Step 2 — Knowledge base (held in memory, saved after brain created)
  const [currentText, setCurrentText] = useState("");
  const [pendingTexts, setPendingTexts] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3 — Prompt
  const [prompt, setPrompt] = useState("");

  // Submission
  const [creating, setCreating] = useState(false);
  const [savingBase, setSavingBase] = useState(false);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const reset = () => {
    setStep(1);
    setName("");
    setDescription("");
    setTags([]);
    setType("person_clone");
    setCurrentText("");
    setPendingTexts([]);
    setPendingFiles([]);
    setPrompt("");
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  // ── Step 1 — Generate description ─────────────────────────────────────────

  const handleGenerateDescription = async () => {
    if (!name.trim()) return toast.error("Digite um nome primeiro");
    setGeneratingDesc(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke(
        "generate-description",
        {
          body: { name: name.trim(), type, tags },
          headers: { Authorization: `Bearer ${session?.access_token}` },
        },
      );
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setDescription(data.description);
      toast.success("Descrição gerada!");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao gerar descrição",
      );
    } finally {
      setGeneratingDesc(false);
    }
  };

  // ── Step 2 — File selection ────────────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter((f) => {
      const ext = f.name.substring(f.name.lastIndexOf(".")).toLowerCase();
      return [".txt", ".pdf", ".docx"].includes(ext);
    });
    if (valid.length < files.length)
      toast.error("Formatos aceitos: .txt, .pdf, .docx");
    setPendingFiles((prev) => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Final creation ─────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!name.trim() || !user) return;
    setCreating(true);
    try {
      // 1. Create brain
      const { data: brain, error: brainError } = await supabase
        .from("brains")
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          type,
          user_id: user.id,
          tags,
          ...(prompt.trim()
            ? ({ system_prompt: prompt.trim() } as unknown as object)
            : {}),
        })
        .select()
        .single();
      if (brainError) throw brainError;

      // 2. Save knowledge base (multiple texts)
      const allTextsToSave = [...pendingTexts];
      if (currentText.trim()) {
        allTextsToSave.push(currentText.trim()); // Also save what's still in the box
      }

      if (allTextsToSave.length > 0) {
        setSavingBase(true);
        for (const pt of allTextsToSave) {
          await supabase.from("brain_texts").insert({
            brain_id: brain.id,
            content: pt,
            source_type: "paste",
          });
        }
      }

      // 3. Upload pending files
      if (pendingFiles.length > 0) {
        setSavingBase(true);
        const {
          data: { session },
        } = await supabase.auth.getSession();
        for (const file of pendingFiles) {
          const ext = file.name
            .substring(file.name.lastIndexOf("."))
            .toLowerCase();
          if (ext === ".txt") {
            const content = await file.text();
            await supabase.from("brain_texts").insert({
              brain_id: brain.id,
              content,
              source_type: "file_upload",
              file_name: file.name,
            });
          } else {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("brainId", brain.id);
            await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-file`,
              {
                method: "POST",
                headers: { Authorization: `Bearer ${session?.access_token}` },
                body: formData,
              },
            );
          }
        }
        // Trigger RAG in background (reuse session from above)
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-rag`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ brainId: brain.id, processAll: true }),
        }).catch(console.error);
      }

      queryClient.invalidateQueries({ queryKey: ["brains"] });
      toast.success("Cérebro criado! 🧠");
      handleClose(false);
      navigate(`/brain/${brain.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setCreating(false);
      setSavingBase(false);
    }
  };

  // ── Step indicator ─────────────────────────────────────────────────────────

  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-5">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
              step > s.id
                ? "bg-primary text-primary-foreground"
                : step === s.id
                  ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {step > s.id ? <Check className="h-3.5 w-3.5" /> : s.id}
          </div>
          <span
            className={`text-xs font-semibold hidden sm:block ${
              step === s.id ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {s.label}
          </span>
          {i < STEPS.length - 1 && (
            <div
              className={`h-px w-8 rounded transition-colors ${
                step > s.id ? "bg-primary" : "bg-border/60"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Novo Cérebro</DialogTitle>
        </DialogHeader>

        <StepIndicator />

        {/* ── STEP 1: Identity ── */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Type selector */}
            <div className="space-y-2">
              <Label>Tipo</Label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  Object.entries(BRAIN_TYPE_CONFIG) as [
                    BrainType,
                    (typeof BRAIN_TYPE_CONFIG)[BrainType],
                  ][]
                ).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setType(key)}
                      className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition-all ${
                        type === key
                          ? "border-primary bg-primary/8 ring-1 ring-primary"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{config.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="brain-name">Nome *</Label>
              <Input
                id="brain-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Einstein, Contabilidade, Estoicismo..."
                onKeyDown={(e) =>
                  e.key === "Enter" && name.trim() && setStep(2)
                }
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>
                Tags{" "}
                <span className="text-muted-foreground font-normal">
                  (opcional)
                </span>
              </Label>
              <TagInput
                tags={tags}
                onChange={setTags}
                placeholder="Ex: filosofia, coaching... (Enter para adicionar)"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="brain-desc">
                  Descrição{" "}
                  <span className="text-muted-foreground font-normal">
                    (opcional)
                  </span>
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerateDescription}
                  disabled={generatingDesc || !name.trim()}
                  className="h-6 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/8 rounded-lg px-2"
                >
                  {generatingDesc ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  Gerar com IA
                </Button>
              </div>
              <Textarea
                id="brain-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva brevemente este cérebro..."
                rows={2}
              />
            </div>

            <Button
              onClick={() => setStep(2)}
              disabled={!name.trim()}
              className="w-full gap-2 gradient-jewel text-white font-semibold rounded-xl"
            >
              Próximo: Base de Conhecimento
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* ── STEP 2: Knowledge Base ── */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Adicione textos ou arquivos para alimentar o cérebro desde o
              início. Você poderá adicionar mais depois na aba{" "}
              <strong>Fontes</strong>.
            </p>

            {/* Paste textarea (auto-resize) */}
            <div className="space-y-2">
              <Label>Colar texto</Label>
              <div className="relative">
                <textarea
                  value={currentText}
                  onChange={(e) => setCurrentText(e.target.value)}
                  placeholder="Cole aqui qualquer texto, artigo, anotações..."
                  style={{ minHeight: 120, maxHeight: 320 }}
                  className="w-full resize-y rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors leading-relaxed"
                />
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-muted-foreground">
                    {currentText.length > 0
                      ? `${currentText.length.toLocaleString()} chars`
                      : ""}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-lg h-7 text-xs gap-1"
                    disabled={!currentText.trim()}
                    onClick={() => {
                      if (currentText.trim()) {
                        setPendingTexts((prev) => [
                          ...prev,
                          currentText.trim(),
                        ]);
                        setCurrentText("");
                      }
                    }}
                  >
                    <Plus className="h-3 w-3" />
                    Adicionar texto
                  </Button>
                </div>
              </div>
            </div>

            {/* File upload */}
            <div className="space-y-2">
              <Label>
                Arquivos{" "}
                <span className="text-muted-foreground font-normal">
                  (.txt, .pdf, .docx)
                </span>
              </Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-xl"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Adicionar arquivo
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.pdf,.docx"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
              {/* Queued sources list */}
              {(pendingFiles.length > 0 || pendingTexts.length > 0) && (
                <div className="mt-4">
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    Fontes na fila ({pendingFiles.length + pendingTexts.length}
                    ):
                  </Label>
                  <ul className="space-y-1">
                    {pendingTexts.map((txt, i) => (
                      <li
                        key={`txt-${i}`}
                        className="flex items-center justify-between text-xs bg-card/60 rounded-lg px-3 py-2 border border-border/40"
                      >
                        <span className="truncate text-foreground">
                          Texto colado ({txt.length} chars)
                        </span>
                        <button
                          className="ml-2 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() =>
                            setPendingTexts((prev) =>
                              prev.filter((_, j) => j !== i),
                            )
                          }
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                    {pendingFiles.map((f, i) => (
                      <li
                        key={`file-${i}`}
                        className="flex items-center justify-between text-xs bg-card/60 rounded-lg px-3 py-2 border border-border/40"
                      >
                        <span className="truncate text-foreground">
                          {f.name}
                        </span>
                        <button
                          className="ml-2 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() =>
                            setPendingFiles((prev) =>
                              prev.filter((_, j) => j !== i),
                            )
                          }
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="gap-1 rounded-xl"
                onClick={() => setStep(1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <Button
                variant="ghost"
                className="gap-1 rounded-xl text-muted-foreground ml-auto"
                onClick={() => setStep(3)}
              >
                <SkipForward className="h-3.5 w-3.5" />
                Pular
              </Button>
              <Button
                className="gap-2 gradient-jewel text-white font-semibold rounded-xl"
                onClick={() => setStep(3)}
                disabled={
                  currentText.trim() === "" &&
                  pendingTexts.length === 0 &&
                  pendingFiles.length === 0
                }
              >
                <Plus className="h-4 w-4" />
                Próximo
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Prompt ── */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Defina como a IA deve se comportar e falar. Você pode deixar em
              branco para usar o padrão, ou editar depois na aba{" "}
              <strong>Prompt</strong>.
            </p>

            <div className="space-y-1">
              <Label>
                System Prompt{" "}
                <span className="text-muted-foreground font-normal">
                  (opcional)
                </span>
              </Label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={`Exemplo:\n🧠 Você é ${name || "o Cérebro"}. Responda sempre em português, com clareza e objetividade...\n\n🎭 ESTILO: direto, provocativo, com exemplos práticos.\n\n🧭 REGRAS: nunca seja genérico. Use os textos da base de conhecimento.`}
                style={{ minHeight: 180, maxHeight: 400 }}
                className="w-full resize-y rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors leading-relaxed"
              />
              {prompt.length > 0 && (
                <p className="text-xs text-muted-foreground text-right">
                  {prompt.length.toLocaleString()} chars
                </p>
              )}
            </div>

            {/* Navigation */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="gap-1 rounded-xl"
                onClick={() => setStep(2)}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <Button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 gap-2 gradient-jewel text-white font-semibold rounded-xl"
              >
                {creating ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4" />
                    {savingBase ? "Salvando base..." : "Criando..."}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Criar Cérebro
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
