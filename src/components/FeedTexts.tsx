import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/lib/i18n";
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
  Upload,
  Trash2,
  FileText,
  Search,
  Link,
  X,
  Sparkles,
  Maximize2,
  Minimize2,
  Edit2,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  brainId: string;
}

export default function FeedTexts({ brainId }: Props) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [textExpanded, setTextExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [importingUrl, setImportingUrl] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [processingRag, setProcessingRag] = useState(false);
  
  // New state for inline editing and expanding
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // expanded source viewer
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: texts, isLoading } = useQuery({
    queryKey: ["brain-texts", brainId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brain_texts")
        .select("*")
        .eq("brain_id", brainId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const triggerRagProcessing = async (textId?: string) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-rag`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(
            textId ? { brainId, textId } : { brainId, processAll: true },
          ),
        },
      );
    } catch (e) {
      console.error("RAG processing error:", e);
    }
  };

  const triggerAnalysis = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-brain`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ brainId }),
      }).catch((e) => console.error("Background analysis error:", e));
    } catch (e) {
      console.error("triggerAnalysis error:", e);
    }
  };

  const addText = async () => {
    if (!text.trim()) return;
    setAdding(true);
    try {
      const { data, error } = await supabase
        .from("brain_texts")
        .insert({
          brain_id: brainId,
          content: text.trim(),
          source_type: "paste",
        })
        .select("id")
        .single();
      if (error) throw error;
      setText("");
      queryClient.invalidateQueries({ queryKey: ["brain-texts", brainId] });
      toast.success(t("feed.textAdded"));
      // Trigger RAG processing in background
      if (data) triggerRagProcessing(data.id);
      // Trigger analysis update in background (fire-and-forget)
      triggerAnalysis();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (![".txt", ".pdf", ".docx"].includes(ext)) {
      toast.error(t("feed.formatsSupported"));
      return;
    }
    setUploading(true);
    try {
      if (ext === ".txt") {
        const content = await file.text();
        const { error } = await supabase.from("brain_texts").insert({
          brain_id: brainId,
          content,
          source_type: "file_upload",
          file_name: file.name,
        });
        if (error) throw error;
      } else {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const formData = new FormData();
        formData.append("file", file);
        formData.append("brainId", brainId);
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-file`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${session?.access_token}` },
            body: formData,
          },
        );
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || "Erro ao processar arquivo");
        }
      }
      queryClient.invalidateQueries({ queryKey: ["brain-texts", brainId] });
      toast.success(`Arquivo "${file.name}" adicionado!`);
      // RAG will be triggered for new texts
      triggerRagProcessing();
      // Auto-update clone analysis
      triggerAnalysis();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleUrlImport = async () => {
    if (!urlInput.trim()) return;
    setImportingUrl(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("import-url-v2", {
        body: { url: urlInput.trim(), brainId },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setUrlInput("");
      setShowUrlInput(false);
      queryClient.invalidateQueries({ queryKey: ["brain-texts", brainId] });
      toast.success(
        `"${data.title}" importado! (${data.chars.toLocaleString()} chars)`,
      );
      triggerRagProcessing();
      // Auto-update clone analysis
      triggerAnalysis();
    } catch (err: any) {
      toast.error(err.message || "Erro ao importar URL");
    } finally {
      setImportingUrl(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("brain_texts")
        .delete()
        .eq("id", deleteTarget);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["brain-texts", brainId] });
      toast.success(t("feed.textRemoved"));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editingContent.trim()) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("brain_texts")
        .update({ content: editingContent.trim() })
        .eq("id", id);
      if (error) throw error;
      toast.success(t("feed.textUpdated") || "Nota atualizada!");
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["brain-texts", brainId] });
      triggerAnalysis();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredTexts = texts?.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.content.toLowerCase().includes(q) ||
      t.file_name?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q)
    );
  });

  const sourceTypeLabel: Record<string, string> = {
    paste: t("feed.pasted"),
    file_upload: t("feed.fileUpload"),
    url_import: t("feed.urlImport"),
    youtube: t("feed.youtubeImport"),
  };

  return (
    <div className="container py-6 space-y-6">
      {/* Add text */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="relative">
            <textarea
              ref={textareaRef}
              placeholder={t("feed.pastePlaceholder")}
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{
                minHeight: textExpanded ? 400 : 96,
                maxHeight: textExpanded ? "70vh" : 240,
                resize: textExpanded ? "vertical" : "both",
                transition: "min-height 0.2s ease, max-height 0.2s ease",
              }}
              className="w-full rounded-xl border border-border/60 bg-background/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors leading-relaxed"
            />
            {/* Expand toggle */}
            <button
              type="button"
              onClick={() => setTextExpanded((v) => !v)}
              title={textExpanded ? "Recolher" : "Expandir"}
              className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              {textExpanded ? (
                <>
                  <Minimize2 className="h-3 w-3" /> Recolher
                </>
              ) : (
                <>
                  <Maximize2 className="h-3 w-3" /> Expandir
                </>
              )}
            </button>
          </div>
          {/* URL import row */}
          {showUrlInput && (
            <div className="flex gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <Input
                placeholder="https://exemplo.com/artigo"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUrlImport()}
                className="rounded-2xl flex-1"
                autoFocus
              />
              <Button
                onClick={handleUrlImport}
                disabled={!urlInput.trim() || importingUrl}
                className="gap-2 rounded-2xl shrink-0"
              >
                {importingUrl ? (
                  <Loader2 className="animate-spin h-4 w-4" />
                ) : (
                  <Link className="h-4 w-4" />
                )}
                Importar
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowUrlInput(false);
                  setUrlInput("");
                }}
                className="rounded-xl shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={addText}
                disabled={!text.trim() || adding}
                className="gap-2"
              >
                {adding ? (
                  <Loader2 className="animate-spin h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {t("feed.addText")}
              </Button>
              <Button variant="outline" className="gap-2" asChild>
                <label className="cursor-pointer">
                  {uploading ? (
                    <Loader2 className="animate-spin h-4 w-4" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                   {t("feed.file")}
                  <input
                    type="file"
                    accept=".txt,.pdf,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setShowUrlInput(!showUrlInput)}
              >
                <Link className="h-4 w-4" />
                {t("feed.importUrl")}
              </Button>
            </div>
            {text.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {text.length.toLocaleString()} chars
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium text-sm text-muted-foreground shrink-0">
            {texts?.length || 0} {t("feed.textsFed")}
          </h3>
          <div className="flex items-center gap-2">
            {(texts?.length || 0) > 0 &&
              texts?.some((t) => !(t as any).rag_processed) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  disabled={processingRag}
                  onClick={async () => {
                    setProcessingRag(true);
                    toast.info(t("feed.processingAi"));
                    await triggerRagProcessing();
                    queryClient.invalidateQueries({
                      queryKey: ["brain-texts", brainId],
                    });
                    toast.success(t("feed.sourcesProcessed"));
                    setProcessingRag(false);
                  }}
                >
                  {processingRag ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  {t("feed.optimizeRag")}
                </Button>
              )}
            {(texts?.length || 0) > 0 && (
              <div className="relative max-w-xs flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder={t("feed.searchTexts")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm rounded-2xl"
                />
              </div>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            {t("common.loading")}
          </div>
        ) : filteredTexts?.length === 0 && searchQuery ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {t("feed.noResults")} "{searchQuery}"
          </div>
        ) : (
          filteredTexts?.map((t) => (
            <Card key={t.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    {t.file_name && (
                      <Badge
                        variant="secondary"
                        className="text-xs max-w-full truncate"
                      >
                        {t.file_name}
                      </Badge>
                    )}
                    {t.source_type && (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {sourceTypeLabel[t.source_type] || t.source_type}
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground/60 shrink-0">
                      {t.content.length.toLocaleString()} chars
                    </span>
                  </div>
                  <div className="flex items-center gap-1 self-end sm:self-auto shrink-0">
                    {editingId !== t.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
                        onClick={() => {
                          setEditingId(t.id);
                          setEditingContent(t.content);
                        }}
                        title="Editar nota"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      onClick={() => setDeleteTarget(t.id)}
                      title="Excluir nota"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {editingId === t.id ? (
                  <div className="space-y-3 mt-2">
                    <textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="w-full min-h-[200px] p-3 rounded-xl bg-background/50 border border-border/60 text-sm focus:outline-none focus:border-primary/50 transition-colors leading-relaxed"
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} disabled={isSaving}>
                        {t("common.cancel") || "Cancelar"}
                      </Button>
                      <Button size="sm" onClick={() => handleSaveEdit(t.id)} disabled={isSaving}>
                        {isSaving && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                        {t("common.save") || "Salvar"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className={`text-sm text-muted-foreground whitespace-pre-wrap ${!expandedIds.has(t.id) ? "line-clamp-4" : ""}`}>
                      {t.content}
                    </p>
                    {t.content.length > 200 && (
                      <button
                        onClick={() => {
                          const newSet = new Set(expandedIds);
                          if (newSet.has(t.id)) newSet.delete(t.id);
                          else newSet.add(t.id);
                          setExpandedIds(newSet);
                        }}
                        className="text-[11px] text-primary mt-1.5 hover:underline font-medium"
                      >
                        {expandedIds.has(t.id) ? "Recolher texto" : "Ler nota inteira"}
                      </button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("feed.removeTextTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("feed.removeTextDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("common.cancel")}</AlertDialogCancel>
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
              {t("common.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
