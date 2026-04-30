import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { generateCalendar } from "@/lib/calendar/generator";
import type { ShiftCategory, CalendarSlot } from "@/types";
import VendedorView from "./VendedorView";

export const dynamic = "force-dynamic";

interface Props {
  params: { year: string; month: string };
}

export default async function VendedorMesPage({ params }: Props) {
  const year = parseInt(params.year);
  const month = parseInt(params.month);

  const session = await getSession();
  if (!session?.workerId) notFound();

  const worker = await prisma.worker.findUnique({
    where: { id: session.workerId },
    include: {
      branchTeam: {
        include: {
          branch: true,
          calendars: { where: { year, month } },
          workers: { where: { activo: true } },
        },
      },
    },
  });

  if (!worker || !worker.activo) notFound();

  const team = worker.branchTeam;
  const calendar = team.calendars[0];

  let slots: CalendarSlot[];
  let assignments: Record<string, string | null> = {};
  let calendarId: string | undefined;

  if (calendar) {
    slots = JSON.parse(calendar.slotsData);
    assignments = JSON.parse(calendar.assignments);
    calendarId = calendar.id;
  } else if (team.categoria) {
    const result = generateCalendar(team.categoria as ShiftCategory, year, month, team.workers.length);
    slots = result.slots;
  } else {
    slots = [];
  }

  // Encontrar qué slot tiene asignado este worker
  const mySlotEntry = Object.entries(assignments).find(([, wid]) => wid === worker.id);
  const mySlotNumber = mySlotEntry ? Number(mySlotEntry[0]) : null;
  const mySlot = mySlotNumber !== null ? slots.find((s) => s.slotNumber === mySlotNumber) ?? null : null;

  return (
    <VendedorView
      workerName={worker.nombre}
      branchName={team.branch.nombre}
      areaNegocio={team.areaNegocio as "ventas" | "postventa"}
      year={year}
      month={month}
      slot={mySlot}
      teamId={team.id}
      calendarId={calendarId}
    />
  );
}
