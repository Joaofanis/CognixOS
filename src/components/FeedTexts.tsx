import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Upload, Trash2, FileText, Search } from "lucide-react";
import { toast } from "sonner";

interface Props {
  brainId: string;
}

export default function FeedTexts({ brainId }: Props) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  const addText = async () => {
    if (!text.trim()) return;
    setAdding(true);
    try {
      const { error } = await supabase
        .from("brain_texts")
        .insert({ brain_id: brainId, content: text.trim(), source_type: "paste" });
      if (error) throw error;
      setText("");
      queryClient.invalidateQueries({ queryKey: ["brain-texts", brainId] });
      toast.success("Texto adicionado!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExtensions = [".txt", ".pdf", ".docx"];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    
    if (!allowedExtensions.includes(ext)) {
      toast.error("Formatos suportados: .txt, .pdf, .docx");
      return;
    }

    setUploading(true);
    try {
      if (ext === ".txt") {
        const content = await file.text();
        const { error } = await supabase
          .from("brain_texts")
          .insert({
            brain_id: brainId,
            content,
            source_type: "file_upload",
            file_name: file.name,
          });
        if (error) throw error;
      } else {
        // PDF or DOCX — send to parse-file edge function
        const { data: { session } } = await supabase.auth.getSession();
        const formData = new FormData();
        formData.append("file", file);
        formData.append("brainId", brainId);

        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-file`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session?.access_token}`,
            },
            body: formData,
          }
        );

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || "Erro ao processar arquivo");
        }
      }

      queryClient.invalidateQueries({ queryKey: ["brain-texts", brainId] });
      toast.success(`Arquivo "${file.name}" adicionado!`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const deleteText = async (textId: string) => {
    try {
      const { error } = await supabase.from("brain_texts").delete().eq("id", textId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["brain-texts", brainId] });
      toast.success("Texto removido");
    } catch (err: any) {
      toast.error(err.message);
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

  return (
    <div className="container py-6 space-y-6">
      {/* Add text */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <Textarea
            placeholder="Cole um texto aqui para alimentar o cérebro..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
          />
          <div className="flex gap-2">
            <Button onClick={addText} disabled={!text.trim() || adding} className="gap-2">
              {adding ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar Texto
            </Button>
            <Button variant="outline" className="gap-2" asChild>
              <label className="cursor-pointer">
                {uploading ? <Loader2 className="animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload Arquivo
                <input
                  type="file"
                  accept=".txt,.pdf,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search & Text list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium text-sm text-muted-foreground shrink-0">
            {texts?.length || 0} texto(s) alimentado(s)
          </h3>
          {(texts?.length || 0) > 0 && (
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar nos textos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm rounded-2xl"
              />
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : filteredTexts?.length === 0 && searchQuery ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhum texto encontrado para "{searchQuery}"
          </div>
        ) : (
          filteredTexts?.map((t) => (
            <Card key={t.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    {t.file_name && (
                      <Badge variant="secondary" className="text-xs">{t.file_name}</Badge>
                    )}
                    {t.category && (
                      <Badge variant="outline" className="text-xs">{t.category}</Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => deleteText(t.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                  {t.content}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
