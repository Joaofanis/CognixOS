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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

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
  const [type, setType] = useState<BrainType>("person_clone");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("brains")
        .insert({ name: name.trim(), description: description.trim() || null, type, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["brains"] });
      toast.success("Cérebro criado!");
      onOpenChange(false);
      setName("");
      setDescription("");
      navigate(`/brain/${data.id}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Novo Cérebro</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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
                      className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-all ${
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
          <div className="space-y-2">
            <Label htmlFor="brain-name">Nome</Label>
            <Input
              id="brain-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Einstein, Contabilidade, Estoicismo..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brain-desc">Descrição (opcional)</Label>
            <Textarea
              id="brain-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva brevemente este cérebro..."
              rows={2}
            />
          </div>
          <Button onClick={handleCreate} disabled={!name.trim() || loading} className="w-full">
            {loading && <Loader2 className="animate-spin" />}
            Criar Cérebro
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
