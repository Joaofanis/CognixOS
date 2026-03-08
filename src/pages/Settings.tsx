import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings, FontSize, Language } from "@/hooks/useSettings";
import { useTranslation } from "@/lib/i18n";
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
  ArrowLeft, Languages, Lock, Trash2, Database, Info,
  Type, Contrast, MonitorCog, Accessibility,
} from "lucide-react";
import { toast } from "sonner";

const LANG_OPTIONS: { value: Language; label: string; flag: string }[] = [
  { value: "pt-BR", label: "Português (BR)", flag: "🇧🇷" },
  { value: "en-US", label: "English (US)", flag: "🇺🇸" },
  { value: "es-ES", label: "Español", flag: "🇪🇸" },
];

export default function Settings() {
  const navigate = useNavigate();
  const { fontSize, setFontSize, highContrast, setHighContrast, reducedMotion, setReducedMotion, language, setLanguage } = useSettings();
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const queryClient = useQueryClient();

  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  const FONT_OPTIONS: { value: FontSize; label: string; desc: string }[] = [
    { value: "normal", label: t("settings.fontNormal"), desc: t("settings.fontNormalDesc") },
    { value: "large", label: t("settings.fontLarge"), desc: t("settings.fontLargeDesc") },
    { value: "xlarge", label: t("settings.fontXlarge"), desc: t("settings.fontXlargeDesc") },
  ];

  const deleteConfirmWord = t("settings.deleteConfirmWord");

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error(t("settings.passwordMinLength"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("settings.passwordMismatch"));
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success(t("settings.passwordChanged"));
      setShowPasswordDialog(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || t("common.error"));
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteText !== deleteConfirmWord) return;
    setDeletingAccount(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("brains").delete().eq("user_id", user.id);
        await supabase.from("profiles").delete().eq("id", user.id);
        await supabase.from("user_ai_profiles").delete().eq("user_id", user.id);
      }
      await signOut();
      toast.success(t("settings.accountDeleted"));
      navigate("/auth");
    } catch (err: any) {
      toast.error(err.message || t("common.error"));
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
    toast.success(t("settings.cacheCleared"));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 glass border-b border-border/50">
        <div className="container flex h-14 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-2xl h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-bold text-lg">{t("settings.title")}</h1>
        </div>
      </header>

      <main className="container max-w-2xl py-8 space-y-6">
        {/* Accessibility */}
        <Card className="rounded-2xl border-border/60">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Accessibility className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">{t("settings.accessibility")}</CardTitle>
            </div>
            <CardDescription>{t("settings.accessibilityDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Type className="h-4 w-4 text-muted-foreground" />
                <Label className="font-semibold">{t("settings.fontSize")}</Label>
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

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Contrast className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="font-semibold">{t("settings.highContrast")}</Label>
                  <p className="text-xs text-muted-foreground">{t("settings.highContrastDesc")}</p>
                </div>
              </div>
              <Switch checked={highContrast} onCheckedChange={setHighContrast} />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MonitorCog className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="font-semibold">{t("settings.reducedMotion")}</Label>
                  <p className="text-xs text-muted-foreground">{t("settings.reducedMotionDesc")}</p>
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
              <CardTitle className="text-lg">{t("settings.language")}</CardTitle>
            </div>
            <CardDescription>{t("settings.languageDesc")}</CardDescription>
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
            <p className="text-xs text-muted-foreground mt-2">{t("settings.languageHint")}</p>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="rounded-2xl border-border/60">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">{t("settings.security")}</CardTitle>
            </div>
            <CardDescription>{t("settings.securityDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start gap-2 rounded-xl" onClick={() => setShowPasswordDialog(true)}>
              <Lock className="h-4 w-4" />
              {t("settings.changePassword")}
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/40" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="h-4 w-4" />
              {t("settings.deleteAccount")}
            </Button>
          </CardContent>
        </Card>

        {/* Data */}
        <Card className="rounded-2xl border-border/60">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">{t("settings.data")}</CardTitle>
            </div>
            <CardDescription>{t("settings.dataDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start gap-2 rounded-xl" onClick={handleClearCache}>
              <Trash2 className="h-4 w-4" />
              {t("settings.clearCache")}
            </Button>
            <p className="text-xs text-muted-foreground">{t("settings.clearCacheDesc")}</p>
          </CardContent>
        </Card>

        {/* About */}
        <Card className="rounded-2xl border-border/60">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">{t("settings.about")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-sm text-foreground font-medium">{t("auth.title")}</p>
            <p className="text-xs text-muted-foreground">{t("settings.version")}</p>
            <p className="text-xs text-muted-foreground">{t("settings.appDesc")}</p>
          </CardContent>
        </Card>
      </main>

      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t("settings.changePasswordDialogTitle")}</DialogTitle>
            <DialogDescription>{t("settings.changePasswordDialogDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t("settings.newPasswordLabel")}</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t("settings.newPasswordPlaceholder")} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.confirmPassword")}</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t("settings.confirmPasswordPlaceholder")} className="rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)} className="rounded-xl">{t("common.cancel")}</Button>
            <Button onClick={handleChangePassword} disabled={changingPassword} className="rounded-xl">
              {changingPassword ? t("settings.changingPassword") : t("settings.changePassword")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirm */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="sm:rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.deleteAccountTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.deleteAccountDesc")}
              <br /><br />
              {language === "en-US" 
                ? <>Type <strong>DELETE</strong> to confirm.</>
                : language === "es-ES"
                ? <>Escribe <strong>ELIMINAR</strong> para confirmar.</>
                : <>Digite <strong>EXCLUIR</strong> para confirmar.</>
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} placeholder={t("settings.deleteConfirmPlaceholder")} className="rounded-xl" />
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleteText !== deleteConfirmWord || deletingAccount}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingAccount ? t("settings.deletingAccount") : t("settings.deleteAccount")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
