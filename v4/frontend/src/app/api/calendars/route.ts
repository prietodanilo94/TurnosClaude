import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  const { teamId, year, month, slotsData, assignments } = await req.json();
  const cal = await prisma.calendar.upsert({
    where: { branchTeamId_year_month: { branchTeamId: teamId, year, month } },
    create: {
      branchTeamId: teamId,
      year,
      month,
      slotsData: JSON.stringify(slotsData),
      assignments: JSON.stringify(assignments),
    },
    update: {
      slotsData: JSON.stringify(slotsData),
      assignments: JSON.stringify(assignments),
    },
  });
  return NextResponse.json({ id: cal.id });
}

export async function PUT(req: NextRequest) {
  const { id, slotsData, assignments } = await req.json();
  const cal = await prisma.calendar.update({
    where: { id },
    data: {
      slotsData: JSON.stringify(slotsData),
      assignments: JSON.stringify(assignments),
    },
  });
  return NextResponse.json({ id: cal.id });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  await prisma.calendar.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
