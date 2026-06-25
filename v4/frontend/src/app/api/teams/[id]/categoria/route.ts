import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { TeamCategoriaBodySchema } from "@/lib/db/schemas";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const parsed = TeamCategoriaBodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", detail: parsed.error.message }, { status: 400 });
  }
  const { categoria } = parsed.data;

  const valid = (await prisma.shiftPattern.findUnique({ where: { id: categoria } })) !== null;
  if (!valid) {
    return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
  }

  const team = await prisma.branchTeam.update({
    where: { id: params.id },
    data: { categoria, categoriaSetAt: new Date() },
  });

  return NextResponse.json({ ok: true, categoria: team.categoria });
}
