import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { generateCalendar } from "@/lib/calendar/generator";
import type { ShiftCategory, CalendarSlot, WorkerBlockInfo } from "@/types";
import VendedorView from "./VendedorView";

export const dynamic = "force-dynamic";

interface Props {
  params: { year: string; month: string };
}

export default async function VendedorMesPage({ params }: Props) {
  const year = parseInt(params.year, 10);
  const month = parseInt(params.month, 10);

  const session = await getSession();
  if (!session?.workerId) notFound();

  const monthStart = new Date(`${params.year}-${String(month).padStart(2, "0")}-01T00:00:00`);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  const worker = await prisma.worker.findUnique({
    where: { id: session.workerId },
    include: {
      blocks: {
        where: {
          startDate: { lte: monthEnd },
          endDate: { gte: monthStart },
        },
        orderBy: [{ startDate: "asc" }, { endDate: "asc" }],
      },
      branchTeam: {
        include: {
          branch: true,
          calendars: { where: { year, month } },
          workers: {
            where: { activo: true },
            include: {
              blocks: {
                where: {
                  startDate: { lte: monthEnd },
                  endDate: { gte: monthStart },
                },
              },
            },
          },
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

  const mySlotEntry = Object.entries(assignments).find(([, workerId]) => workerId === worker.id);
  const mySlotNumber = mySlotEntry ? Number(mySlotEntry[0]) : null;
  const mySlot = mySlotNumber !== null ? slots.find((slot) => slot.slotNumber === mySlotNumber) ?? null : null;

  const workerBlocks: WorkerBlockInfo[] = worker.blocks.map((block) => ({
    id: block.id,
    workerId: worker.id,
    startDate: block.startDate.toISOString().slice(0, 10),
    endDate: block.endDate.toISOString().slice(0, 10),
    motivo: block.motivo,
  }));

  return (
    <VendedorView
      workerName={worker.nombre}
      branchName={team.branch.nombre}
      areaNegocio={team.areaNegocio as "ventas" | "postventa"}
      year={year}
      month={month}
      slot={mySlot}
      workerBlocks={workerBlocks}
      teamId={team.id}
      calendarId={calendarId}
    />
  );
}
