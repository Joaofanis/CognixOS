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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur-sm">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">Segundo Cérebro</span>
          </div>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Search & Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cérebros..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Cérebro
          </Button>
        </div>

        {/* Type Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Badge
            variant={filterType === "all" ? "default" : "outline"}
            className="cursor-pointer shrink-0"
            onClick={() => setFilterType("all")}
          >
            Todos
          </Badge>
          {(Object.entries(BRAIN_TYPE_CONFIG) as [BrainType, typeof BRAIN_TYPE_CONFIG[BrainType]][]).map(
            ([key, config]) => (
              <Badge
                key={key}
                variant={filterType === key ? "default" : "outline"}
                className="cursor-pointer shrink-0"
                onClick={() => setFilterType(key)}
              >
                {config.label}
              </Badge>
            )
          )}
        </div>

        {/* Brain Cards Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader><div className="h-5 bg-muted rounded w-2/3" /></CardHeader>
                <CardContent><div className="h-4 bg-muted rounded w-full" /></CardContent>
              </Card>
            ))}
          </div>
        ) : filtered?.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Nenhum cérebro encontrado</p>
            <p className="text-sm">Crie seu primeiro cérebro para começar!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered?.map((brain) => {
              const config = BRAIN_TYPE_CONFIG[brain.type as BrainType];
              const Icon = config?.icon || Brain;
              return (
                <Card
                  key={brain.id}
                  className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
                  onClick={() => navigate(`/brain/${brain.id}`)}
                >
                  <CardHeader className="flex flex-row items-center gap-3 pb-2">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-${config?.color}/15`}>
                      <Icon className={`h-5 w-5 text-${config?.color}`} />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{brain.name}</CardTitle>
                      <Badge variant="secondary" className="text-xs mt-1">
                        {config?.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  {brain.description && (
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {brain.description}
                      </p>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <CreateBrainDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}
