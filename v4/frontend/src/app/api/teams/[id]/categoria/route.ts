import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { isBuiltIn } from "@/lib/patterns/catalog";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { categoria } = await req.json();

  const valid = isBuiltIn(categoria) || (await prisma.shiftPattern.findUnique({ where: { id: categoria } })) !== null;
  if (!valid) {
    return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
  }

  const team = await prisma.branchTeam.update({
    where: { id: params.id },
    data: { categoria, categoriaSetAt: new Date() },
  });

  return NextResponse.json({ ok: true, categoria: team.categoria });
}
