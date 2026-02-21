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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  brain: {
    id: string;
    name: string;
    description: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditBrainDialog({ brain, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(brain.name);
  const [description, setDescription] = useState(brain.description || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setName(brain.name);
    setDescription(brain.description || "");
  }, [brain]);

  const handleUpdate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("brains")
        .update({ 
          name: name.trim(), 
          description: description.trim() || null,
          updated_at: new Date().toISOString()
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Cérebro</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nome</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Einstein, Contabilidade..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-desc">Descrição (opcional)</Label>
            <Textarea
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva brevemente este cérebro..."
              rows={3}
            />
          </div>
          <Button onClick={handleUpdate} disabled={!name.trim() || loading} className="w-full">
            {loading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
            Salvar Alterações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
