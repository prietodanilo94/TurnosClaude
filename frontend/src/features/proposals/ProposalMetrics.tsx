import type { ProposalMetrics } from "@/types/optimizer";

interface ProposalMetricsProps {
  metrics: ProposalMetrics;
}

function balanceLabel(std: number): { label: string; className: string } {
  if (std <= 1) return { label: "excelente", className: "text-green-600" };
  if (std <= 3) return { label: "bueno",     className: "text-yellow-600" };
  return           { label: "regular",       className: "text-orange-600" };
}

export function ProposalMetricsView({ metrics }: ProposalMetricsProps) {
  const balance = balanceLabel(metrics.desviacion_horas);

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
      <dt className="text-gray-500">Score</dt>
      <dd className="font-medium text-gray-800">{metrics.score.toFixed(1)}</dd>

      <dt className="text-gray-500">Horas prom/pers</dt>
      <dd className="font-medium text-gray-800">{metrics.horas_promedio.toFixed(1)} h</dd>

      <dt className="text-gray-500">Balance</dt>
      <dd className={`font-medium ${balance.className}`}>{balance.label}</dd>

      <dt className="text-gray-500">Cobertura peak</dt>
      <dd className="font-medium text-gray-800">{metrics.cobertura_peak_pct.toFixed(1)} %</dd>

      <dt className="text-gray-500">Turnos cortos</dt>
      <dd className="font-medium text-gray-800">{metrics.turnos_cortos_count}</dd>

      <dt className="text-gray-500">Fines de semana completos</dt>
      <dd className="font-medium text-gray-800">{metrics.fin_semana_completo_count}</dd>
    </dl>
  );
}
