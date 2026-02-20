import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Upload, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";

interface Props {
  brainId: string;
}

export default function FeedTexts({ brainId }: Props) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);

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

    // Only handle .txt for now; pdf/docx need server-side parsing
    if (!file.name.endsWith(".txt")) {
      toast.error("Por enquanto, apenas arquivos .txt são suportados");
      return;
    }

    setUploading(true);
    try {
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
                Upload .txt
                <input
                  type="file"
                  accept=".txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Text list */}
      <div className="space-y-3">
        <h3 className="font-medium text-sm text-muted-foreground">
          {texts?.length || 0} texto(s) alimentado(s)
        </h3>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : (
          texts?.map((t) => (
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
