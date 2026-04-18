"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Query } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import type { Proposal } from "@/types/models";
import type { ProposalMetrics } from "@/types/optimizer";

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main";
const PROPOSALS_COLLECTION = "proposals";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseMetrics(raw: string | undefined): ProposalMetrics | undefined {
  if (!raw) return undefined;
  try { return JSON.parse(raw); } catch { return undefined; }
}

function parseAssignments(raw: string): { slot: number; date: string; shift_id: string }[] {
  try { return JSON.parse(raw); } catch { return []; }
}

/** Cuenta asignaciones por fecha para el mini calendario. */
function countByDate(asignaciones: { date: string }[]): Record<string, number> {
  return asignaciones.reduce<Record<string, number>>((acc, a) => {
    acc[a.date] = (acc[a.date] ?? 0) + 1;
    return acc;
  }, {});
}

/** Genera las fechas del mes (YYYY-MM-DD). */
function monthDates(year: number, month: number): string[] {
  const days = new Date(year, month, 0).getDate(); // 0-day del mes siguiente = último día del mes
  return Array.from({ length: days }, (_, i) => {
    const d = i + 1;
    return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  });
}

// ─── Mini calendario (read-only) ──────────────────────────────────────────────

const DAY_HEADERS = ["L", "M", "X", "J", "V", "S", "D"];

function MiniCalendar({ year, month, countMap }: {
  year: number;
  month: number;
  countMap: Record<string, number>;
}) {
  const dates = monthDates(year, month);
  // Día de semana del primer día (0=domingo → convertir a lunes=0)
  const firstDow = new Date(year, month - 1, 1).getDay();
  const offset = (firstDow + 6) % 7; // lunes=0 ... domingo=6

  function cellColor(count: number | undefined): string {
    if (!count) return "bg-gray-100 text-gray-400";
    if (count === 1) return "bg-yellow-100 text-yellow-700";
    if (count === 2) return "bg-green-100 text-green-700";
    return "bg-green-200 text-green-800";
  }

  return (
    <div className="text-xs">
      {/* Cabeceras */}
      <div className="grid grid-cols-7 gap-px mb-1">
        {DAY_HEADERS.map((h) => (
          <div key={h} className="text-center font-medium text-gray-500 py-0.5">{h}</div>
        ))}
      </div>
      {/* Celdas */}
      <div className="grid grid-cols-7 gap-px">
        {/* Espacios vacíos antes del primer día */}
        {Array.from({ length: offset }, (_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {dates.map((date) => {
          const day = parseInt(date.slice(8), 10);
          const count = countMap[date];
          return (
            <div
              key={date}
              title={count ? `${count} turno(s)` : "Sin asignaciones"}
              className={`rounded text-center py-0.5 ${cellColor(count)}`}
            >
              {day}
            </div>
          );
        })}
      </div>
      {/* Leyenda */}
      <div className="flex gap-3 mt-2 text-gray-500">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-gray-100" /> 0</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-yellow-100" /> 1</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-green-100" /> 2</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-green-200" /> 3+</span>
      </div>
    </div>
  );
}

// ─── Tabla de métricas comparativa ────────────────────────────────────────────

interface MetricRow {
  label: string;
  key: keyof ProposalMetrics;
  format: (v: number) => string;
  better: "max" | "min";
}

const METRIC_ROWS: MetricRow[] = [
  { label: "Score",                   key: "score",                   format: (v) => v.toFixed(1),       better: "max" },
  { label: "Horas prom/pers",         key: "horas_promedio",          format: (v) => `${v.toFixed(1)} h`, better: "max" },
  { label: "Desv. estándar horas",    key: "desviacion_horas",        format: (v) => `${v.toFixed(2)} h`, better: "min" },
  { label: "Cobertura peak",          key: "cobertura_peak_pct",      format: (v) => `${v.toFixed(1)} %`, better: "max" },
  { label: "Turnos cortos",           key: "turnos_cortos_count",     format: (v) => String(v),           better: "min" },
  { label: "Fin. sem. completos",     key: "fin_semana_completo_count", format: (v) => String(v),         better: "max" },
];

function isBetter(row: MetricRow, a: number, b: number): boolean {
  return row.better === "max" ? a > b : a < b;
}

function MetricsTable({ m1, m2 }: { m1: ProposalMetrics; m2: ProposalMetrics }) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="bg-gray-50 text-gray-600 text-left">
          <th className="px-3 py-2 font-medium border-b border-gray-200">Métrica</th>
          <th className="px-3 py-2 font-medium border-b border-gray-200 text-center">Propuesta A</th>
          <th className="px-3 py-2 font-medium border-b border-gray-200 text-center">Propuesta B</th>
        </tr>
      </thead>
      <tbody>
        {METRIC_ROWS.map((row) => {
          const va = m1[row.key] as number;
          const vb = m2[row.key] as number;
          const aWins = va !== vb && isBetter(row, va, vb);
          const bWins = va !== vb && isBetter(row, vb, va);
          return (
            <tr key={row.key} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-3 py-2 text-gray-600">{row.label}</td>
              <td className={`px-3 py-2 text-center font-medium ${aWins ? "text-green-700 bg-green-50" : "text-gray-800"}`}>
                {row.format(va)}{aWins && " ★"}
              </td>
              <td className={`px-3 py-2 text-center font-medium ${bWins ? "text-green-700 bg-green-50" : "text-gray-800"}`}>
                {row.format(vb)}{bWins && " ★"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface CompareClientProps {
  branchId: string;
  year: number;
  month: number;
}

export function CompareClient({ branchId, year, month }: CompareClientProps) {
  const router = useRouter();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [idA, setIdA] = useState<string>("");
  const [idB, setIdB] = useState<string>("");

  const gridUrl = `/admin/sucursales/${branchId}/mes/${year}/${month}/propuestas`;

  const loadProposals = useCallback(async () => {
    setLoading(true);
    try {
      const result = await databases.listDocuments(DATABASE_ID, PROPOSALS_COLLECTION, [
        Query.equal("branch_id", branchId),
        Query.equal("anio", year),
        Query.equal("mes", month),
        Query.notEqual("estado", "descartada"),
        Query.orderDesc("score"),
      ]);
      const docs = result.documents as unknown as Proposal[];
      setProposals(docs);
      if (docs.length >= 1) setIdA(docs[0].$id);
      if (docs.length >= 2) setIdB(docs[1].$id);
    } catch {
      setErrorMsg("No se pudieron cargar las propuestas (bootstrap pendiente).");
    } finally {
      setLoading(false);
    }
  }, [branchId, year, month]);

  useEffect(() => { loadProposals(); }, [loadProposals]);

  const propA = proposals.find((p) => p.$id === idA);
  const propB = proposals.find((p) => p.$id === idB);
  const metricsA = parseMetrics(propA?.metrics);
  const metricsB = parseMetrics(propB?.metrics);

  const countMapA = propA ? countByDate(parseAssignments(propA.asignaciones as unknown as string)) : {};
  const countMapB = propB ? countByDate(parseAssignments(propB.asignaciones as unknown as string)) : {};

  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  return (
    <div className="p-6 space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Comparar propuestas — {monthLabel}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Sucursal: {branchId}</p>
        </div>
        <button onClick={() => router.push(gridUrl)} className="text-sm text-blue-600 hover:underline">
          ← Volver a propuestas
        </button>
      </div>

      {errorMsg && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-2">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Cargando propuestas…</p>
      ) : proposals.length < 2 ? (
        <p className="text-sm text-gray-500">
          Se necesitan al menos 2 propuestas para comparar.{" "}
          <button onClick={() => router.push(gridUrl)} className="text-blue-600 hover:underline">
            Ver propuestas generadas.
          </button>
        </p>
      ) : (
        <div className="space-y-6">
          {/* Selectores */}
          <div className="flex flex-wrap gap-6">
            {(["A", "B"] as const).map((label) => {
              const currentId = label === "A" ? idA : idB;
              const setId = label === "A" ? setIdA : setIdB;
              const otherId = label === "A" ? idB : idA;
              return (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Propuesta {label}:</span>
                  <select
                    value={currentId}
                    onChange={(e) => setId(e.target.value)}
                    className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {proposals.map((p, i) => (
                      <option key={p.$id} value={p.$id} disabled={p.$id === otherId}>
                        #{i + 1} {p.modo.toUpperCase()} — score {p.score.toFixed(1)}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          {/* Comparación lado a lado */}
          {propA && propB && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tabla de métricas */}
              <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <h2 className="text-sm font-semibold text-gray-700">Métricas comparativas</h2>
                  <p className="text-xs text-gray-500 mt-0.5">★ indica el mejor valor por fila</p>
                </div>
                {metricsA && metricsB ? (
                  <MetricsTable m1={metricsA} m2={metricsB} />
                ) : (
                  <p className="p-4 text-sm text-gray-400 italic">
                    Métricas no disponibles (propuestas generadas sin optimizer).
                  </p>
                )}
              </div>

              {/* Mini calendario A */}
              <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-4 space-y-3">
                <h2 className="text-sm font-semibold text-gray-700">
                  Propuesta A — {propA.modo.toUpperCase()} (score {propA.score.toFixed(1)})
                </h2>
                <MiniCalendar year={year} month={month} countMap={countMapA} />
              </div>

              {/* Mini calendario B */}
              <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-4 space-y-3">
                <h2 className="text-sm font-semibold text-gray-700">
                  Propuesta B — {propB.modo.toUpperCase()} (score {propB.score.toFixed(1)})
                </h2>
                <MiniCalendar year={year} month={month} countMap={countMapB} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
