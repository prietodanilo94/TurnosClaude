import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { isBuiltIn } from "@/lib/patterns/catalog";

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
