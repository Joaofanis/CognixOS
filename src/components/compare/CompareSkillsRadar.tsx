import { Zap } from "lucide-react";
import CompareRadarChart from "./CompareRadarChart";

interface Props {
  data: Array<{ trait: string; A: number; B: number }>;
  nameA: string;
  nameB: string;
}

export default function CompareSkillsRadar({ data, nameA, nameB }: Props) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Zap className="h-4 w-4 text-yellow-400" />
        <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>HABILIDADES ESPECÍFICAS</span>
      </div>
      <CompareRadarChart data={data} nameA={nameA} nameB={nameB} title="Comparação — Habilidades" />
    </div>
  );
}
