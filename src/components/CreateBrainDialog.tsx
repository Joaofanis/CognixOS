import { useState } from "react";
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
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import TagInput from "@/components/TagInput";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateBrainDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [type, setType] = useState<BrainType>("person_clone");
  const [loading, setLoading] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);

  const handleGenerateDescription = async () => {
    if (!name.trim()) {
      toast.error("Digite um nome primeiro para gerar a descrição");
      return;
    }
    setGeneratingDesc(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("generate-description", {
        body: { name: name.trim(), type, tags },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setDescription(data.description);
      toast.success("Descrição gerada!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar descrição";
      toast.error(msg);
    } finally {
      setGeneratingDesc(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("brains")
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          type,
          user_id: user.id,
          tags,
        })
        .select()
        .single();
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["brains"] });
      toast.success("Cérebro criado!");
      onOpenChange(false);
      setName("");
      setDescription("");
      setTags([]);
      navigate(`/brain/${data.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Novo Cérebro</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Type selector */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(BRAIN_TYPE_CONFIG) as [BrainType, typeof BRAIN_TYPE_CONFIG[BrainType]][]).map(
                ([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setType(key)}
                      className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition-all ${
                        type === key
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{config.label}</span>
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="brain-name">Nome</Label>
            <Input
              id="brain-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Einstein, Contabilidade, Estoicismo..."
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
              <Label htmlFor="brain-desc">
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
              id="brain-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva brevemente este cérebro, ou clique em 'Gerar com IA'..."
              rows={2}
            />
          </div>

          <Button onClick={handleCreate} disabled={!name.trim() || loading} className="w-full gradient-jewel text-white font-semibold rounded-xl">
            {loading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
            Criar Cérebro
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
