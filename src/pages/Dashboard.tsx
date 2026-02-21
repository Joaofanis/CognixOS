import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BRAIN_TYPE_CONFIG, BrainType } from "@/lib/brain-types";
import { Plus, Search, LogOut, Brain } from "lucide-react";
import { toast } from "sonner";
import CreateBrainDialog from "@/components/CreateBrainDialog";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<BrainType | "all">("all");
  const [showCreate, setShowCreate] = useState(false);

  const { data: brains, isLoading } = useQuery({
    queryKey: ["brains"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brains")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
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
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
      {/* Header */}
      <header className="sticky top-0 z-10 glass border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2 group transition-all">
            <div className="p-2 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <Brain className="h-6 w-6 text-primary animate-pulse" />
            </div>
            <span className="font-bold text-xl tracking-tight text-gradient">Segundo Cérebro</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-8 max-w-6xl">
        {/* Search & Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Buscar mentes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 h-12 bg-card/50 border-border/50 focus:border-primary/50 transition-all rounded-2xl shadow-sm"
            />
          </div>
          <Button onClick={() => setShowCreate(true)} className="h-12 px-6 gap-2 rounded-2xl gradient-primary shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all">
            <Plus className="h-5 w-5" /> Criar Cérebro
          </Button>
        </div>

        {/* Type Filters */}
        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
          <Badge
            variant={filterType === "all" ? "default" : "outline"}
            className={`cursor-pointer shrink-0 px-4 py-1.5 rounded-full transition-all ${
              filterType === "all" ? "shadow-md bg-primary" : "hover:border-primary/50"
            }`}
            onClick={() => setFilterType("all")}
          >
            Todos
          </Badge>
          {(Object.entries(BRAIN_TYPE_CONFIG) as [BrainType, typeof BRAIN_TYPE_CONFIG[BrainType]][]).map(
            ([key, config]) => (
              <Badge
                key={key}
                variant={filterType === key ? "default" : "outline"}
                className={`cursor-pointer shrink-0 px-4 py-1.5 rounded-full transition-all ${
                  filterType === key ? "shadow-md bg-primary" : "hover:border-primary/50"
                }`}
                onClick={() => setFilterType(key)}
              >
                {config.label}
              </Badge>
            )
          )}
        </div>

        {/* Brain Cards Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-44 rounded-3xl bg-card/50 animate-pulse border border-border/50" />
            ))}
          </div>
        ) : filtered?.length === 0 ? (
          <div className="text-center py-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="h-24 w-24 bg-card rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-border/50">
              <Brain className="h-12 w-12 text-muted-foreground opacity-30" />
            </div>
            <p className="text-xl font-medium text-foreground">Sua mente está calma demais...</p>
            <p className="text-muted-foreground mt-2 mb-8">Crie seu primeiro cérebro para começar a alimentar seu conhecimento!</p>
            <Button variant="outline" onClick={() => setShowCreate(true)} className="rounded-full px-8">
              Começar Agora
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered?.map((brain) => {
              const config = BRAIN_TYPE_CONFIG[brain.type as BrainType];
              const Icon = config?.icon || Brain;
              return (
                <div
                  key={brain.id}
                  className="group relative cursor-pointer"
                  onClick={() => navigate(`/brain/${brain.id}`)}
                >
                  <Card className="h-full border-border/50 bg-card/50 hover:bg-card hover:border-primary/30 transition-all duration-300 rounded-3xl overflow-hidden group-hover:shadow-xl group-hover:shadow-primary/5 group-hover:-translate-y-1">
                    <CardHeader className="flex flex-row items-center gap-4 pb-2">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/5 group-hover:bg-primary/10 transition-colors`}>
                        <Icon className={`h-6 w-6 text-primary`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-lg font-bold truncate group-hover:text-primary transition-colors">
                          {brain.name}
                        </CardTitle>
                        <Badge variant="secondary" className="text-[10px] uppercase tracking-wider font-bold bg-muted/50 text-muted-foreground h-5">
                          {config?.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    {brain.description && (
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                          {brain.description}
                        </p>
                      </CardContent>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-primary/0 via-primary/0 to-primary/0 group-hover:via-primary/50 transition-all duration-500" />
                  </Card>
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
