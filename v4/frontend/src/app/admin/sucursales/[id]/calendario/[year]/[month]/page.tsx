import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { generateCalendar } from "@/lib/calendar/generator";
import { getSession } from "@/lib/auth/session";
import type { ShiftCategory, CalendarSlot } from "@/types";
import CalendarView from "./CalendarView";

interface Props {
  params: { id: string; year: string; month: string };
  searchParams: { team?: string };
}

export const dynamic = "force-dynamic";

export default async function CalendarioPage({ params, searchParams }: Props) {
  const year = parseInt(params.year);
  const month = parseInt(params.month);

  if (!searchParams.team) notFound();

  // Verificar acceso para jefes
  const session = await getSession();
  if (session?.role === "jefe") {
    const allowed = session.branchIds ?? [];
    if (!allowed.includes(params.id)) notFound();
  }

  const team = await prisma.branchTeam.findUnique({
    where: { id: searchParams.team },
    include: {
      branch: true,
      workers: { where: { activo: true }, orderBy: { nombre: "asc" } },
      calendars: { where: { year, month } },
    },
  });

  if (!team || team.branchId !== params.id) notFound();
  if (!team.categoria) {
    return (
      <div className="p-6">
        <p className="text-sm text-orange-600">
          Este equipo no tiene categoría de turno asignada.
        </p>
      </div>
    );
  }

  const workerCount = team.workers.length;

  // Generar o recuperar slots
  let slots: CalendarSlot[];
  let assignments: Record<string, string | null> = {};
  let calendarId: string | undefined;
  let alert: string | undefined;

  const existing = team.calendars[0];
  if (existing) {
    slots = JSON.parse(existing.slotsData);
    assignments = JSON.parse(existing.assignments);
    calendarId = existing.id;
  } else {
    const result = generateCalendar(team.categoria as ShiftCategory, year, month, workerCount);
    slots = result.slots;
    alert = result.alert;
  }

  const workerMap = Object.fromEntries(team.workers.map((w) => [w.id, w.nombre]));

  return (
    <CalendarView
      branchId={params.id}
      branchName={team.branch.nombre}
      branchCodigo={team.branch.codigo}
      teamId={team.id}
      areaNegocio={team.areaNegocio as "ventas" | "postventa"}
      categoria={team.categoria as ShiftCategory}
      year={year}
      month={month}
      slots={slots}
      assignments={assignments}
      workers={team.workers.map((w) => ({ id: w.id, nombre: w.nombre, rut: w.rut, activo: w.activo, esVirtual: w.esVirtual }))}
      workerMap={workerMap}
      calendarId={calendarId}
      generateAlert={alert}
    />
  );
}
