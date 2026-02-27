import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import TagInput from "@/components/TagInput";

interface Props {
  brain: {
    id: string;
    name: string;
    description: string | null;
    type?: string;
    tags?: string[] | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditBrainDialog({ brain, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(brain.name);
  const [description, setDescription] = useState(brain.description || "");
  const [tags, setTags] = useState<string[]>(brain.tags || []);
  const [loading, setLoading] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);

  useEffect(() => {
    setName(brain.name);
    setDescription(brain.description || "");
    setTags(brain.tags || []);
  }, [brain]);

  const handleGenerateDescription = async () => {
    if (!name.trim()) {
      toast.error("Digite um nome primeiro");
      return;
    }
    setGeneratingDesc(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("generate-description", {
        body: { name: name.trim(), type: brain.type || "person_clone", tags },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setDescription(data.description);
      toast.success("Descrição gerada!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar descrição");
    } finally {
      setGeneratingDesc(false);
    }
  };

  const handleUpdate = async () => {
    if (!name.trim()) return;
    setLoading(true);
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

      queryClient.invalidateQueries({ queryKey: ["brains"] });
      queryClient.invalidateQueries({ queryKey: ["brain", brain.id] });
      toast.success("Cérebro atualizado!");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Cérebro</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nome</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Einstein, Contabilidade..."
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <TagInput tags={tags} onChange={setTags} placeholder="Ex: filosofia, coaching... (Enter para adicionar)" />
          </div>

          {/* Description with AI button */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-desc">
                Descrição <span className="text-muted-foreground font-normal">(opcional)</span>
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
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva brevemente este cérebro, ou clique em 'Gerar com IA'..."
              rows={3}
            />
          </div>

          <Button
            onClick={handleUpdate}
            disabled={!name.trim() || loading}
            className="w-full gradient-jewel text-white font-semibold rounded-xl"
          >
            {loading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
            Salvar Alterações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
