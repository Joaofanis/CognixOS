import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brain, Loader2, Sparkles, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email, password);
        navigate("/");
      } else {
        await signUp(email, password, displayName);
        toast.success(t("auth.accountCreated"));
      }
    } catch (err: any) {
      toast.error(err.message || t("auth.authError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-mesh bg-background relative flex items-center justify-center p-4 overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-60 -left-60 w-[500px] h-[500px] bg-primary/12 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-[400px] h-[400px] bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-40 bg-primary/6 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700 relative">
        <div className="text-center mb-8">
          <div className="relative inline-flex mb-4">
            <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20 flex items-center justify-center shadow-xl shadow-primary/20">
              <Brain className="h-10 w-10 text-primary" />
            </div>
            <div className="absolute -top-1 -right-1 h-6 w-6 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center shadow-lg">
              <Sparkles className="h-3 w-3 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gradient mb-1">
            {t("auth.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isLogin ? t("auth.loginSubtitle") : t("auth.signupSubtitle")}
          </p>
        </div>

        <div className="glass border border-border/60 rounded-3xl p-8 shadow-2xl shadow-black/20">
          <div className="flex rounded-2xl bg-muted/50 p-1 mb-6 gap-1">
            {[t("auth.login"), t("auth.signup")].map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => setIsLogin(i === 0)}
                className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  (i === 0) === isLogin
                    ? "bg-primary text-white shadow-md shadow-primary/30"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                <Label htmlFor="name" className="text-sm font-semibold">
                  {t("auth.name")}
                </Label>
                <Input
                  id="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t("auth.namePlaceholder")}
                  className="rounded-2xl h-11 bg-background/60 border-border/60 focus:border-primary/60"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-semibold">
                {t("auth.email")}
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="rounded-2xl h-11 bg-background/60 border-border/60 focus:border-primary/60"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-semibold">
                {t("auth.password")}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="rounded-2xl h-11 bg-background/60 border-border/60 focus:border-primary/60 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-2xl gradient-jewel text-white font-bold shadow-lg shadow-primary/25 hover:opacity-90 hover:shadow-primary/40 active:scale-[0.98] transition-all mt-2 gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isLogin ? t("auth.login") : t("auth.signup")}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground/60 mt-6">
          {t("auth.dataPrivate")}
        </p>
      </div>
    </div>
  );
}
