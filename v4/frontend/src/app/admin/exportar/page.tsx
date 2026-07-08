import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import type { CalendarSlot, DayShift } from "@/types";
import ExportarMasivoClient, { type MasivoRow } from "./ExportarMasivoClient";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: { year?: string; month?: string };
}

// F10 fase 8 — Exportar Masivo: toda la empresa, UN mes a la vez (el mes es
// explicito y obligatorio para que nunca se mezclen meses en una carga al
// sistema central — incidente 2026-07-07).
export default async function ExportarMasivoPage({ searchParams }: Props) {
  await getSession();
  const now = new Date();
  const year = parseInt(searchParams.year ?? "", 10) || now.getFullYear();
  const month = parseInt(searchParams.month ?? "", 10) || now.getMonth() + 1;

  const calendars = await prisma.calendar.findMany({
    where: { year, month },
    include: {
      branchTeam: {
        include: {
          branch: { select: { id: true, nombre: true, codigo: true } },
          workers: { where: { activo: true }, select: { id: true, nombre: true, rut: true } },
        },
      },
    },
  });

  const rows: MasivoRow[] = [];
  for (const cal of calendars) {
    let slots: CalendarSlot[]; let assignments: Record<string, string | null>;
    try {
      slots = JSON.parse(cal.slotsData);
      assignments = JSON.parse(cal.assignments);
    } catch { continue; }
    const byId = new Map(cal.branchTeam.workers.map((w) => [w.id, w]));
    for (const slot of slots) {
      const wid = assignments[String(slot.slotNumber)];
      if (!wid) continue;
      const w = byId.get(wid);
      if (!w || !w.rut) continue;
      const days: string[] = [];
      for (let d = 1; d <= 31; d++) {
        const ds = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const sh = (slot.days as Record<string, DayShift | null>)[ds] ?? null;
        days.push(sh ? `${sh.start} a ${sh.end}` : "");
      }
      rows.push({
        area: cal.branchTeam.areaNegocio,
        sucursal: cal.branchTeam.branch.nombre,
        codigo: cal.branchTeam.branch.codigo,
        branchId: cal.branchTeam.branch.id,
        trabajador: w.nombre,
        rut: w.rut.split("-")[0],
        days,
      });
    }
  }
  rows.sort((a, b) => a.sucursal.localeCompare(b.sucursal, "es") || a.trabajador.localeCompare(b.trabajador, "es"));

  return <ExportarMasivoClient rows={rows} year={year} month={month} />;
}
