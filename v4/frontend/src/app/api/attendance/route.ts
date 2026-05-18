import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId");
  const year   = searchParams.get("year");
  const month  = searchParams.get("month");

  if (!teamId || !year || !month)
    return NextResponse.json({ error: "Missing params" }, { status: 400 });

  const workers = await prisma.worker.findMany({
    where: { branchTeamId: teamId },
    select: { rut: true },
  });
  const ruts = workers.map((w) => w.rut);
  if (ruts.length === 0) return NextResponse.json([]);

  const monthPrefix = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
  const records = await prisma.attendanceRecord.findMany({
    where: { rut: { in: ruts }, fecha: { startsWith: monthPrefix } },
    select: { rut: true, fecha: true, entrada: true, salida: true },
  });

  return NextResponse.json(records);
}

export async function POST(req: Request) {
  const apiKey = process.env.ATTENDANCE_API_KEY;
  if (apiKey && req.headers.get("x-api-key") !== apiKey)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { records: { rut: string; fecha: string; entrada?: string | null; salida?: string | null }[] };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { records } = body;
  if (!Array.isArray(records) || records.length === 0)
    return NextResponse.json({ error: "No records" }, { status: 400 });

  let count = 0;
  for (const r of records) {
    if (!r.rut || !r.fecha) continue;
    await prisma.attendanceRecord.upsert({
      where: { rut_fecha: { rut: r.rut, fecha: r.fecha } },
      update: { entrada: r.entrada ?? null, salida: r.salida ?? null },
      create: { rut: r.rut, fecha: r.fecha, entrada: r.entrada ?? null, salida: r.salida ?? null },
    });
    count++;
  }

  return NextResponse.json({ count });
}
