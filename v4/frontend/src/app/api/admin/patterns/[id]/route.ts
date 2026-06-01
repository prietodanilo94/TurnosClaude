import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { isBuiltIn } from "@/lib/patterns/catalog";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (isBuiltIn(params.id)) {
    return NextResponse.json({ error: "No se puede modificar una categoría incorporada" }, { status: 400 });
  }
  const { label, areaNegocio, rotationWeeks, weeklyHours } = await req.json() as {
    label: string;
    areaNegocio: string;
    rotationWeeks: unknown;
    weeklyHours: unknown;
  };
  if (!label || !areaNegocio || !rotationWeeks || !weeklyHours) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }
  const updated = await prisma.shiftPattern.update({
    where: { id: params.id },
    data: {
      label,
      areaNegocio,
      rotationJson: JSON.stringify(rotationWeeks),
      weeklyHoursJson: JSON.stringify(weeklyHours),
    },
  });
  return NextResponse.json({ ok: true, id: updated.id });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (isBuiltIn(params.id)) {
    return NextResponse.json({ error: "No se puede eliminar una categoría incorporada" }, { status: 400 });
  }

  const exists = await prisma.shiftPattern.findUnique({ where: { id: params.id } });
  if (!exists) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  // Clear categoria from all teams using this pattern
  await prisma.branchTeam.updateMany({
    where: { categoria: params.id },
    data: { categoria: null, categoriaSetAt: null },
  });

  await prisma.shiftPattern.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
