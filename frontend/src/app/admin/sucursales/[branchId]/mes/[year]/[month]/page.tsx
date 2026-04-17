import { CalendarClientWrapper } from "./CalendarClientWrapper";
import type { OptimizerProposal, ShiftDef } from "@/types/optimizer";
import type { Worker } from "@/types/models";

interface PageProps {
  params: { branchId: string; year: string; month: string };
}

// ─── Mock data ────────────────────────────────────────────────────────────────
// Se reemplaza por fetch real a Appwrite cuando las propuestas se persistan.

function buildMockData(branchId: string, year: number, month: number) {
  const workers: Worker[] = [
    { $id: "w1", $createdAt: "", $updatedAt: "", rut: "11222333-9", nombre_completo: "Ana García", branch_id: branchId, activo: true },
    { $id: "w2", $createdAt: "", $updatedAt: "", rut: "22333444-5", nombre_completo: "Bruno López", branch_id: branchId, activo: true },
    { $id: "w3", $createdAt: "", $updatedAt: "", rut: "33444555-1", nombre_completo: "Carla Muñoz", branch_id: branchId, activo: true },
    { $id: "w4", $createdAt: "", $updatedAt: "", rut: "44555666-7", nombre_completo: "Diego Rojas", branch_id: branchId, activo: true },
    { $id: "w5", $createdAt: "", $updatedAt: "", rut: "55666777-3", nombre_completo: "Elena Soto", branch_id: branchId, activo: true },
  ];

  const shiftCatalog: ShiftDef[] = [
    { id: "S_09_14", inicio: "09:00", fin: "14:00", duracion_minutos: 300, descuenta_colacion: false },
    { id: "S_14_19", inicio: "14:00", fin: "19:00", duracion_minutos: 300, descuenta_colacion: false },
  ];

  const franjaPorDia: Record<string, { apertura: string; cierre: string } | null> = {
    lunes:     { apertura: "09:00", cierre: "19:00" },
    martes:    { apertura: "09:00", cierre: "19:00" },
    miercoles: { apertura: "09:00", cierre: "19:00" },
    jueves:    { apertura: "09:00", cierre: "19:00" },
    viernes:   { apertura: "09:00", cierre: "19:00" },
    sabado:    { apertura: "09:00", cierre: "14:00" },
    domingo:   null,
  };

  const holidays = ["2026-05-01", "2026-05-21"];

  // Generar asignaciones: dos turnos por día de lunes a viernes, un turno los sábados
  const asignaciones: OptimizerProposal["asignaciones"] = [];
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  const holidaySet = new Set(holidays);
  const slotWorkers = workers.map((w) => w.rut);
  let workerIdx = 0;

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const dow = d.getUTCDay(); // 0=dom, 6=sab
    if (dow === 0 || holidaySet.has(dateStr)) continue;

    const shifts = dow === 6 ? ["S_09_14"] : ["S_09_14", "S_14_19"];
    for (const shift_id of shifts) {
      const rut = slotWorkers[workerIdx % slotWorkers.length];
      const slot = (workerIdx % slotWorkers.length) + 1;
      asignaciones.push({ worker_slot: slot, worker_rut: rut, date: dateStr, shift_id });
      workerIdx++;
    }
  }

  // Segunda propuesta con orden de workers invertido para probar el selector
  const asignaciones2 = asignaciones.map((a, i) => ({
    ...a,
    worker_rut: slotWorkers[(slotWorkers.length - 1 - (i % slotWorkers.length))],
    worker_slot: slotWorkers.length - (i % slotWorkers.length),
  }));

  const proposals: OptimizerProposal[] = [
    {
      id: "prop_mock_1",
      modo: "greedy",
      score: 87.5,
      factible: true,
      dotacion_minima_sugerida: 2,
      asignaciones,
    },
    {
      id: "prop_mock_2",
      modo: "ilp",
      score: 92.3,
      factible: true,
      dotacion_minima_sugerida: 2,
      asignaciones: asignaciones2,
    },
  ];

  return { workers, shiftCatalog, franjaPorDia, holidays, proposals };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CalendarPage({ params }: PageProps) {
  const { branchId, year: yearStr, month: monthStr } = params;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return (
      <div className="p-6 text-red-600">Parámetros de URL inválidos.</div>
    );
  }

  // TODO: reemplazar por fetch real a Appwrite cuando las propuestas se persistan
  const { workers, shiftCatalog, franjaPorDia, holidays, proposals } =
    buildMockData(branchId, year, month);

  return (
    <CalendarClientWrapper
      branchId={branchId}
      year={year}
      month={month}
      proposals={proposals}
      workers={workers}
      shiftCatalog={shiftCatalog}
      holidays={holidays}
      franjaPorDia={franjaPorDia}
    />
  );
}
