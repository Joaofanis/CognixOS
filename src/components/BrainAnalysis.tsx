import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, BarChart3, Brain as BrainIcon } from "lucide-react";
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
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("analyze-brain", {
        body: { brainId },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });
      if (error) {
        // supabase.functions.invoke wraps non-2xx as error
        const msg = typeof data === "object" && data?.error ? data.error : error.message;
        throw new Error(msg || "Erro ao gerar análise");
      }
      if (data?.error) throw new Error(data.error);
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
          <Card className="glass border-primary/10 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BrainIcon className="h-4 w-4 text-primary" />
                Traços de Personalidade
              </CardTitle>
            </CardHeader>
            <CardContent>
              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid stroke="hsla(var(--primary), 0.1)" />
                    <PolarAngleAxis 
                      dataKey="trait" 
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }} 
                    />
                    <PolarRadiusAxis 
                      angle={30} 
                      domain={[0, 10]} 
                      tick={false}
                      axisLine={false}
                    />
                    <Radar
                      name="Personalidade"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.3}
                      strokeWidth={3}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8 italic">Dados de personalidade indisponíveis</p>
              )}
            </CardContent>
          </Card>

          {/* Bar Chart */}
          <Card className="glass border-primary/10 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Temas Frequentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {themes && themes.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart 
                    data={themes} 
                    layout="vertical" 
                    margin={{ left: 20, right: 30, top: 10, bottom: 10 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={140} 
                      tick={{ 
                        fontSize: 11, 
                        fill: "hsl(var(--muted-foreground))",
                        fontWeight: 500
                      }}
                      axisLine={false}
                      tickLine={false}
                      // Funcao de truncagem para nomes muito longos
                      tickFormatter={(value) => value.length > 25 ? `${value.substring(0, 22)}...` : value}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(var(--primary), 0.05)' }} 
                      contentStyle={{ 
                        backgroundColor: 'rgba(var(--background), 0.8)',
                        backdropFilter: 'blur(8px)',
                        borderRadius: '12px',
                        border: '1px solid rgba(var(--primary), 0.2)',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        padding: '10px'
                      }}
                      itemStyle={{ color: 'hsl(var(--primary))', fontWeight: 'bold' }}
                      labelStyle={{ color: 'hsl(var(--foreground))', marginBottom: '4px' }}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="hsl(var(--primary))" 
                      radius={[0, 8, 8, 0]} 
                      barSize={24}
                      className="transition-all duration-300 hover:opacity-80"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8 italic">Sem dados suficientes para análise temática</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
