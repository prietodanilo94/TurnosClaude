import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { logAction } from "@/lib/audit/log";
import { parseDateOnly } from "@/lib/dates";

async function requireAdmin() {
  const session = await getSession();
  return session?.role === "admin";
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const workerId = req.nextUrl.searchParams.get("workerId");
  if (!workerId) {
    return NextResponse.json({ error: "workerId es requerido" }, { status: 400 });
  }

  const today = parseDateOnly(new Date().toISOString().slice(0, 10));
  const blocks = await prisma.workerBlock.findMany({
    where: {
      workerId,
      endDate: { gte: today },
    },
    orderBy: [{ startDate: "asc" }, { endDate: "asc" }],
  });

  return NextResponse.json(
    blocks.map((block) => ({
      id: block.id,
      workerId: block.workerId,
      startDate: block.startDate.toISOString().slice(0, 10),
      endDate: block.endDate.toISOString().slice(0, 10),
      motivo: block.motivo,
    })),
  );
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const { workerId, startDate, endDate, motivo } = await req.json();
  if (!workerId || !startDate || !endDate) {
    return NextResponse.json({ error: "workerId, startDate y endDate son requeridos" }, { status: 400 });
  }

  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (start > end) {
    return NextResponse.json({ error: "El rango de fechas es invalido" }, { status: 400 });
  }

  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    include: {
      branchTeam: {
        select: {
          branchId: true,
          branch: { select: { nombre: true } },
        },
      },
    },
  });

  if (!worker) {
    return NextResponse.json({ error: "Trabajador no encontrado" }, { status: 404 });
  }

  const overlapping = await prisma.workerBlock.findFirst({
    where: {
      workerId,
      startDate: { lte: end },
      endDate: { gte: start },
    },
  });

  if (overlapping) {
    return NextResponse.json({ error: "Ya existe un bloqueo que se cruza con ese rango" }, { status: 409 });
  }

  const block = await prisma.workerBlock.create({
    data: {
      workerId,
      startDate: start,
      endDate: end,
      motivo: motivo?.trim() || null,
    },
  });

  await logAction({
    action: "worker.block",
    entityType: "block",
    entityId: block.id,
    branchId: worker.branchTeam.branchId,
    metadata: {
      workerId,
      workerNombre: worker.nombre,
      branchName: worker.branchTeam.branch.nombre,
      startDate,
      endDate,
      motivo: motivo?.trim() || null,
    },
    req,
  });

  return NextResponse.json({
    id: block.id,
    workerId: block.workerId,
    startDate: block.startDate.toISOString().slice(0, 10),
    endDate: block.endDate.toISOString().slice(0, 10),
    motivo: block.motivo,
  });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id es requerido" }, { status: 400 });
  }

  const block = await prisma.workerBlock.findUnique({
    where: { id },
    include: {
      worker: {
        include: {
          branchTeam: {
            select: {
              branchId: true,
              branch: { select: { nombre: true } },
            },
          },
        },
      },
    },
  });

  if (!block) {
    return NextResponse.json({ error: "Bloqueo no encontrado" }, { status: 404 });
  }

  await prisma.workerBlock.delete({ where: { id } });

  await logAction({
    action: "worker.unblock",
    entityType: "block",
    entityId: id,
    branchId: block.worker.branchTeam.branchId,
    metadata: {
      workerId: block.workerId,
      workerNombre: block.worker.nombre,
      branchName: block.worker.branchTeam.branch.nombre,
      startDate: block.startDate.toISOString().slice(0, 10),
      endDate: block.endDate.toISOString().slice(0, 10),
      motivo: block.motivo,
    },
    req,
  });

  return NextResponse.json({ ok: true });
}
