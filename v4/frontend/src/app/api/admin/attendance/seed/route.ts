import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionFromRequest } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function parseT(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function fmtT(mins: number) {
  const h = Math.floor(Math.max(0, mins) / 60) % 24;
  const m = Math.max(0, mins) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function rnd(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { teamId, year, month } = await req.json() as { teamId: string; year: number; month: number };

  const calendar = await prisma.calendar.findUnique({
    where: { branchTeamId_year_month: { branchTeamId: teamId, year: Number(year), month: Number(month) } },
  });
  if (!calendar) return NextResponse.json({ error: "Calendar not found" }, { status: 404 });

  type SlotEntry = { slotNumber: number; days: Record<string, { start: string; end: string } | null> };
  const slotsArr = JSON.parse(calendar.slotsData) as SlotEntry[];
  const assignments = JSON.parse(calendar.assignments) as Record<string, string | null>;

  const workers = await prisma.worker.findMany({
    where: { branchTeamId: teamId, activo: true },
    select: { id: true, rut: true },
  });
  const workerRutMap = Object.fromEntries(workers.map((w) => [w.id, w.rut]));

  const todayStr = new Date().toISOString().slice(0, 10);
  const monthPrefix = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;

  const toUpsert: { rut: string; fecha: string; entrada: string; salida: string | null }[] = [];

  for (const slot of slotsArr) {
    const workerId = assignments[String(slot.slotNumber)];
    if (!workerId) continue;
    const rut = workerRutMap[workerId];
    if (!rut) continue;

    for (const [fecha, shift] of Object.entries(slot.days)) {
      if (!shift || !fecha.startsWith(monthPrefix) || fecha >= todayStr) continue;
      const entrada = fmtT(parseT(shift.start) + rnd(-5, 25));
      const salida  = Math.random() > 0.08 ? fmtT(parseT(shift.end) + rnd(-5, 20)) : null;
      toUpsert.push({ rut, fecha, entrada, salida });
    }
  }

  let count = 0;
  for (const r of toUpsert) {
    await prisma.attendanceRecord.upsert({
      where: { rut_fecha: { rut: r.rut, fecha: r.fecha } },
      update: { entrada: r.entrada, salida: r.salida },
      create: r,
    });
    count++;
  }

  return NextResponse.json({ count });
}
