import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BRAIN_TYPE_CONFIG, BrainType } from "@/lib/brain-types";
import { Plus, Search, LogOut, Brain, Sparkles, GitCompareArrows, FileText, MessageSquare, User } from "lucide-react";
import { toast } from "sonner";
import CreateBrainDialog from "@/components/CreateBrainDialog";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<BrainType | "all">("all");
  const [showCreate, setShowCreate] = useState(false);

  const { data: brains, isLoading } = useQuery({
    queryKey: ["brains", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brains")
        .select("*")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch counts for texts and conversations
  const { data: textCounts } = useQuery({
    queryKey: ["brain-text-counts", user?.id],
    enabled: !!brains && brains.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brain_texts")
        .select("brain_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((t) => {
        counts[t.brain_id] = (counts[t.brain_id] || 0) + 1;
      });
      return counts;
    },
  });

  const { data: convCounts } = useQuery({
    queryKey: ["brain-conv-counts", user?.id],
    enabled: !!brains && brains.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("brain_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((c) => {
        counts[c.brain_id] = (counts[c.brain_id] || 0) + 1;
      });
      return counts;
    },
  });

  const filtered = brains?.filter((b) => {
    const matchSearch = b.name.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || b.type === filterType;
    return matchSearch && matchType;
  });

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-mesh bg-background">
      {/* Ambient gradient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-primary/8 rounded-full blur-3xl" />
        <div className="absolute -top-20 right-20 w-60 h-60 bg-accent/6 rounded-full blur-3xl" />
        <div className="absolute bottom-40 left-1/2 -translate-x-1/2 w-96 h-40 bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20 glass border-b border-border/50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3 group transition-all">
            <div className="relative">
              <div className="p-2.5 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 group-hover:from-primary/30 group-hover:to-accent/20 transition-colors shadow-sm">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-gradient-to-br from-primary to-accent rounded-full" />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-gradient">
              Segundo Cérebro
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/profile")}
              className="rounded-2xl h-9 w-9 hover:bg-primary/10"
            >
              <User className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground hidden sm:block font-medium">
              {user?.email}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="rounded-2xl h-9 w-9 hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-10 space-y-8 max-w-6xl relative">
        {/* Hero greeting */}
        <div className="space-y-1 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Olá, <span className="text-gradient">{user?.email?.split("@")[0]}</span> 👋
          </h1>
          <p className="text-muted-foreground">
            Seus cérebros estão à sua espera.
          </p>
        </div>

        {/* Search & Actions */}
        <div className="flex flex-col sm:flex-row gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Buscar mentes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 h-12 bg-card/60 border-border/50 focus:border-primary/50 transition-all rounded-2xl shadow-sm"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/compare")}
            className="h-12 px-5 gap-2 rounded-2xl font-semibold"
          >
            <GitCompareArrows className="h-4 w-4" />
            Comparar
          </Button>
          <Button
            onClick={() => setShowCreate(true)}
            className="h-12 px-6 gap-2 rounded-2xl gradient-jewel hover:opacity-90 shadow-lg shadow-primary/25 hover:shadow-primary/40 active:scale-[0.98] transition-all text-white font-semibold"
          >
            <Plus className="h-5 w-5" />
            Criar Cérebro
          </Button>
        </div>

        {/* Type Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar animate-in fade-in duration-500 delay-150">
          <Badge
            variant={filterType === "all" ? "default" : "outline"}
            className={`cursor-pointer shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filterType === "all"
                ? "gradient-jewel border-transparent text-white shadow-md shadow-primary/20"
                : "hover:border-primary/50 hover:text-primary"
            }`}
            onClick={() => setFilterType("all")}
          >
            Todos
          </Badge>
          {(
            Object.entries(BRAIN_TYPE_CONFIG) as [
              BrainType,
              (typeof BRAIN_TYPE_CONFIG)[BrainType]
            ][]
          ).map(([key, config]) => (
            <Badge
              key={key}
              variant={filterType === key ? "default" : "outline"}
              className={`cursor-pointer shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                filterType === key
                  ? "gradient-jewel border-transparent text-white shadow-md shadow-primary/20"
                  : "hover:border-primary/50 hover:text-primary"
              }`}
              onClick={() => setFilterType(key)}
            >
              {config.label}
            </Badge>
          ))}
        </div>

        {/* Brain Cards Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-48 rounded-3xl bg-card/50 animate-pulse border border-border/40"
              />
            ))}
          </div>
        ) : filtered?.length === 0 ? (
          <div className="text-center py-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="relative inline-block mb-6">
              <div className="h-24 w-24 bg-card/80 rounded-3xl flex items-center justify-center mx-auto shadow-lg border border-border/50">
                <Brain className="h-12 w-12 text-muted-foreground/30" />
              </div>
              <div className="absolute -top-2 -right-2 h-8 w-8 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary/50" />
              </div>
            </div>
            <p className="text-xl font-bold text-foreground">
              Sua mente está calma demais...
            </p>
            <p className="text-muted-foreground mt-2 mb-8 max-w-xs mx-auto">
              Crie seu primeiro cérebro para começar a alimentar seu conhecimento!
            </p>
            <Button
              onClick={() => setShowCreate(true)}
              className="rounded-2xl px-8 py-5 gradient-jewel text-white shadow-lg shadow-primary/25 hover:opacity-90 transition-all"
            >
              Começar Agora
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
            {filtered?.map((brain, idx) => {
              const config = BRAIN_TYPE_CONFIG[brain.type as BrainType];
              const Icon = config?.icon || Brain;
              const textsCount = textCounts?.[brain.id] || 0;
              const convsCount = convCounts?.[brain.id] || 0;
              return (
                <div
                  key={brain.id}
                  className="group relative cursor-pointer card-lift glow-on-hover rounded-3xl"
                  onClick={() => navigate(`/brain/${brain.id}`)}
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  {/* Gradient border on hover */}
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/0 to-accent/0 group-hover:from-primary/20 group-hover:to-accent/10 transition-all duration-500 pointer-events-none" />
                  
                  <div className="h-full min-h-[160px] border border-border/60 bg-card shadow-sm hover:border-primary/40 hover:shadow-md transition-all duration-300 rounded-3xl overflow-hidden p-5 space-y-4">
                    {/* Top row */}
                    <div className="flex items-center gap-4">
                      <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/10 group-hover:from-primary/25 group-hover:to-accent/20 transition-all shadow-sm border border-primary/10 p-3">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="font-bold text-base truncate group-hover:text-primary transition-colors">
                          {brain.name}
                        </h2>
                        <Badge
                          variant="secondary"
                          className="text-[10px] uppercase tracking-widest font-bold bg-primary/8 text-primary/70 border-0 mt-1"
                        >
                          {config?.label}
                        </Badge>
                      </div>
                    </div>

                    {/* Description */}
                    {brain.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                        {brain.description}
                      </p>
                    )}

                    {/* Counts */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {textsCount} fonte{textsCount !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {convsCount} conversa{convsCount !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {/* Bottom accent bar */}
                    <div className="h-0.5 rounded-full bg-gradient-to-r from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/70 group-hover:via-accent/50 group-hover:to-jade/30 transition-all duration-500" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <CreateBrainDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}
