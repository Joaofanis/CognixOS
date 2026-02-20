import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function Compare() {
  const navigate = useNavigate();
  const [brainA, setBrainA] = useState<string>("");
  const [brainB, setBrainB] = useState<string>("");

  const { data: personBrains } = useQuery({
    queryKey: ["person-brains"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brains")
        .select("id, name")
        .eq("type", "person_clone")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: analysisA } = useQuery({
    queryKey: ["brain-analysis", brainA],
    queryFn: async () => {
      const { data } = await supabase.from("brain_analysis").select("*").eq("brain_id", brainA).single();
      return data;
    },
    enabled: !!brainA,
  });

  const { data: analysisB } = useQuery({
    queryKey: ["brain-analysis", brainB],
    queryFn: async () => {
      const { data } = await supabase.from("brain_analysis").select("*").eq("brain_id", brainB).single();
      return data;
    },
    enabled: !!brainB,
  });

  // Merge traits for overlay chart
  const traitsA = (analysisA?.personality_traits || {}) as Record<string, number>;
  const traitsB = (analysisB?.personality_traits || {}) as Record<string, number>;
  const allTraits = new Set([...Object.keys(traitsA), ...Object.keys(traitsB)]);
  const radarData = Array.from(allTraits).map((trait) => ({
    trait,
    A: traitsA[trait] || 0,
    B: traitsB[trait] || 0,
  }));

  const nameA = personBrains?.find((b) => b.id === brainA)?.name || "A";
  const nameB = personBrains?.find((b) => b.id === brainB)?.name || "B";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur-sm">
        <div className="container flex h-14 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold">Comparar Cérebros</h1>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select value={brainA} onValueChange={setBrainA}>
            <SelectTrigger><SelectValue placeholder="Selecionar Cérebro A" /></SelectTrigger>
            <SelectContent>
              {personBrains?.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={brainB} onValueChange={setBrainB}>
            <SelectTrigger><SelectValue placeholder="Selecionar Cérebro B" /></SelectTrigger>
            <SelectContent>
              {personBrains?.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {brainA && brainB && radarData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comparação de Personalidade</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="trait" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <PolarRadiusAxis angle={30} domain={[0, 10]} />
                  <Radar name={nameA} dataKey="A" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
                  <Radar name={nameB} dataKey="B" stroke="hsl(var(--accent))" fill="hsl(var(--accent))" fillOpacity={0.15} strokeWidth={2} />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
