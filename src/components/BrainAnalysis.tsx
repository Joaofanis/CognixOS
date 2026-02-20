import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

interface Props {
  brainId: string;
}

export default function BrainAnalysis({ brainId }: Props) {
  const [generating, setGenerating] = useState(false);

  const { data: analysis, refetch } = useQuery({
    queryKey: ["brain-analysis", brainId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brain_analysis")
        .select("*")
        .eq("brain_id", brainId)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  const generateAnalysis = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-brain", {
        body: { brainId },
      });
      if (error) throw error;
      refetch();
      toast.success("Análise gerada!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar análise");
    } finally {
      setGenerating(false);
    }
  };

  const traits = analysis?.personality_traits as Record<string, number> | null;
  const themes = analysis?.frequent_themes as Array<{ name: string; count: number }> | null;

  const radarData = traits
    ? Object.entries(traits).map(([key, value]) => ({
        trait: key,
        value: value,
        fullMark: 10,
      }))
    : [];

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Análise de Personalidade</h3>
        <Button onClick={generateAnalysis} disabled={generating} variant="outline" size="sm" className="gap-2">
          {generating ? <Loader2 className="animate-spin h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
          {analysis ? "Atualizar" : "Gerar"} Análise
        </Button>
      </div>

      {!analysis ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>Nenhuma análise gerada ainda.</p>
          <p className="text-sm">Adicione textos e clique em "Gerar Análise".</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Radar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Traços de Personalidade</CardTitle>
            </CardHeader>
            <CardContent>
              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="trait" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fontSize: 10 }} />
                    <Radar
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
              )}
            </CardContent>
          </Card>

          {/* Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Temas Frequentes</CardTitle>
            </CardHeader>
            <CardContent>
              {themes && themes.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={themes} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
