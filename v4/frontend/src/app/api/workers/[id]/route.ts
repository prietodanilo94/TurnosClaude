import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { clearWorkerFromFutureCalendars } from "@/lib/calendar/cleanupStaleAssignments";

async function requireAdmin() {
  const session = await getSession();
  return session?.role === "admin";
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const { password, clearPassword, nombre, branchTeamId, activo } = await req.json();
  const data: Record<string, unknown> = {};

  if (clearPassword) data.passwordHash = null;
  else if (password) data.passwordHash = await bcrypt.hash(password, 12);

  if (nombre !== undefined) data.nombre = String(nombre).trim();
  if (branchTeamId !== undefined) data.branchTeamId = branchTeamId;
  if (activo !== undefined) data.activo = activo;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Sin campos para actualizar" }, { status: 400 });
  }

  const before = await prisma.worker.findUnique({
    where: { id: params.id },
    select: { branchTeamId: true },
  });

  const worker = await prisma.worker.update({
    where: { id: params.id },
    data,
    include: {
      branchTeam: {
        include: {
          branch: {
            select: {
              id: true,
              nombre: true,
              codigo: true,
              supervisors: { select: { supervisor: { select: { id: true, nombre: true } } } },
            },
          },
        },
      },
    },
  });

  // Si se desactivo, o si cambio de equipo, no debe seguir apareciendo
  // asignado en calendarios del mes actual o futuros de su equipo anterior.
  const leftOldTeam = branchTeamId !== undefined && before && before.branchTeamId !== branchTeamId;
  const wasDeactivated = activo === false;
  if ((leftOldTeam || wasDeactivated) && before) {
    await clearWorkerFromFutureCalendars([params.id], before.branchTeamId);
  }

  return NextResponse.json(worker);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  // Limpiar antes de eliminar: una vez borrado el Worker, su id ya no se
  // puede resolver a un nombre y queda como referencia huerfana ("?") en
  // cualquier calendario donde siga asignado.
  await clearWorkerFromFutureCalendars([params.id]);
  await prisma.worker.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
