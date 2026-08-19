import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log";

// Agrega un equipo nuevo a una sucursal que YA existe. Antes solo se podia
// crear un equipo al crear la sucursal por primera vez — no existia forma de
// sumar mas equipos despues. Necesario para separar una misma area de
// negocio (ej. postventa) en varios equipos por cargo/patron real, ya que
// una sucursal ahora puede tener varios equipos con la misma areaNegocio
// (ver BranchTeam en schema.prisma, restriccion unica removida 2026-08).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json() as { areaNegocio?: string; categoria?: string | null };
  const areaNegocio = body.areaNegocio;
  const categoria = body.categoria || null;

  if (areaNegocio !== "ventas" && areaNegocio !== "postventa") {
    return NextResponse.json({ error: "Área de negocio inválida" }, { status: 400 });
  }

  const branch = await prisma.branch.findUnique({ where: { id: params.id } });
  if (!branch) {
    return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
  }

  if (categoria) {
    const pattern = await prisma.shiftPattern.findUnique({ where: { id: categoria } });
    if (!pattern) {
      return NextResponse.json({ error: "Categoría no encontrada" }, { status: 400 });
    }
    if (pattern.areaNegocio !== areaNegocio) {
      return NextResponse.json({ error: "La categoría no corresponde al área de negocio" }, { status: 400 });
    }
  }

  const team = await prisma.branchTeam.create({
    data: {
      branchId: branch.id,
      areaNegocio,
      categoria,
      categoriaSetAt: categoria ? new Date() : null,
    },
  });

  await logAction({
    action: "branchTeam.create",
    entityType: "branchTeam",
    entityId: team.id,
    branchId: branch.id,
    metadata: { areaNegocio, categoria, branchNombre: branch.nombre },
    req,
  });

  return NextResponse.json({ id: team.id });
}
