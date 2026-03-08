import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings, FontSize, Language } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Eye, Languages, Lock, Trash2, Database, Info,
  Type, Contrast, MonitorCog, Accessibility,
} from "lucide-react";
import { toast } from "sonner";

const FONT_OPTIONS: { value: FontSize; label: string; desc: string }[] = [
  { value: "normal", label: "Normal", desc: "16px — padrão" },
  { value: "large", label: "Grande", desc: "18px — leitura confortável" },
  { value: "xlarge", label: "Extra Grande", desc: "20px — alta visibilidade" },
];

const LANG_OPTIONS: { value: Language; label: string; flag: string }[] = [
  { value: "pt-BR", label: "Português (BR)", flag: "🇧🇷" },
  { value: "en-US", label: "English (US)", flag: "🇺🇸" },
  { value: "es-ES", label: "Español", flag: "🇪🇸" },
];

export default function Settings() {
  const navigate = useNavigate();
  const { fontSize, setFontSize, highContrast, setHighContrast, reducedMotion, setReducedMotion, language, setLanguage } = useSettings();
  const { signOut } = useAuth();
  const queryClient = useQueryClient();

  // Password change
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Senha alterada com sucesso!");
      setShowPasswordDialog(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar senha");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteText !== "EXCLUIR") return;
    setDeletingAccount(true);
    try {
      // Delete user data (brains cascade handles texts, quotes, etc.)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("brains").delete().eq("user_id", user.id);
        await supabase.from("profiles").delete().eq("id", user.id);
        await supabase.from("user_ai_profiles").delete().eq("user_id", user.id);
      }
      await signOut();
      toast.success("Conta excluída. Seus dados foram removidos.");
      navigate("/auth");
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir conta");
    } finally {
      setDeletingAccount(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleClearCache = () => {
    const authKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("sb-") || key === "app-settings")) {
        authKeys.push(key);
      }
    }
    const preserved: Record<string, string> = {};
    authKeys.forEach((k) => { preserved[k] = localStorage.getItem(k) || ""; });
    localStorage.clear();
    Object.entries(preserved).forEach(([k, v]) => localStorage.setItem(k, v));
    queryClient.clear();
    toast.success("Cache limpo com sucesso!");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 glass border-b border-border/50">
        <div className="container flex h-14 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-2xl h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-bold text-lg">Configurações</h1>
        </div>
      </header>

      <main className="container max-w-2xl py-8 space-y-6">
        {/* Accessibility */}
        <Card className="rounded-2xl border-border/60">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Accessibility className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Acessibilidade</CardTitle>
            </div>
            <CardDescription>Ajuste a interface para suas necessidades</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Font Size */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Type className="h-4 w-4 text-muted-foreground" />
                <Label className="font-semibold">Tamanho da Fonte</Label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {FONT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFontSize(opt.value)}
                    className={`rounded-xl border p-3 text-center transition-all ${
                      fontSize === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40 text-foreground"
                    }`}
                  >
                    <span className="block font-semibold text-sm">{opt.label}</span>
                    <span className="block text-[11px] text-muted-foreground mt-0.5">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* High Contrast */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Contrast className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="font-semibold">Alto Contraste</Label>
                  <p className="text-xs text-muted-foreground">Aumenta contraste de cores para melhor legibilidade</p>
                </div>
              </div>
              <Switch checked={highContrast} onCheckedChange={setHighContrast} />
            </div>

            {/* Reduced Motion */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MonitorCog className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="font-semibold">Reduzir Animações</Label>
                  <p className="text-xs text-muted-foreground">Desativa animações para reduzir estímulos visuais</p>
                </div>
              </div>
              <Switch checked={reducedMotion} onCheckedChange={setReducedMotion} />
            </div>
          </CardContent>
        </Card>

        {/* Language */}
        <Card className="rounded-2xl border-border/60">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Languages className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Idioma</CardTitle>
            </div>
            <CardDescription>Defina o idioma do corretor ortográfico e da interface</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {LANG_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="rounded-lg">
                    <span className="flex items-center gap-2">
                      <span>{opt.flag}</span>
                      <span>{opt.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              O corretor ortográfico do chat usará o idioma selecionado.
            </p>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="rounded-2xl border-border/60">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Segurança</CardTitle>
            </div>
            <CardDescription>Gerencie sua senha e conta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start gap-2 rounded-xl" onClick={() => setShowPasswordDialog(true)}>
              <Lock className="h-4 w-4" />
              Alterar Senha
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/40" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="h-4 w-4" />
              Excluir Conta
            </Button>
          </CardContent>
        </Card>

        {/* Data */}
        <Card className="rounded-2xl border-border/60">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Dados</CardTitle>
            </div>
            <CardDescription>Gerencie seus dados locais</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start gap-2 rounded-xl" onClick={handleClearCache}>
              <Trash2 className="h-4 w-4" />
              Limpar Cache Local
            </Button>
            <p className="text-xs text-muted-foreground">
              Remove dados armazenados no navegador sem desconectar sua conta.
            </p>
          </CardContent>
        </Card>

        {/* About */}
        <Card className="rounded-2xl border-border/60">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Sobre</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-sm text-foreground font-medium">Segundo Cérebro</p>
            <p className="text-xs text-muted-foreground">Versão 1.0.0</p>
            <p className="text-xs text-muted-foreground">Plataforma de clones de IA e base de conhecimento</p>
          </CardContent>
        </Card>
      </main>

      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
            <DialogDescription>Digite sua nova senha abaixo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Confirmar Senha</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repita a nova senha" className="rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleChangePassword} disabled={changingPassword} className="rounded-xl">
              {changingPassword ? "Alterando..." : "Alterar Senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirm */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="sm:rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Conta</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Todos os seus cérebros, textos, conversas e perfil serão permanentemente excluídos.
              <br /><br />
              Digite <strong>EXCLUIR</strong> para confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} placeholder="Digite EXCLUIR" className="rounded-xl" />
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleteText !== "EXCLUIR" || deletingAccount}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingAccount ? "Excluindo..." : "Excluir Conta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
