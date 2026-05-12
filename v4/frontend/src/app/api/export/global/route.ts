import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const [workers, supervisors] = await Promise.all([
    prisma.worker.findMany({
      include: {
        branchTeam: {
          include: { branch: { select: { nombre: true, codigo: true } } },
        },
      },
      orderBy: [{ branchTeam: { branch: { nombre: "asc" } } }, { nombre: "asc" }],
    }),
    prisma.supervisor.findMany({
      include: { branches: { include: { branch: { select: { nombre: true } } } } },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const wb = XLSX.utils.book_new();

  const workersData = workers.map((w) => ({
    RUT: w.rut,
    Nombre: w.nombre,
    Sucursal: w.branchTeam.branch.nombre,
    Codigo: w.branchTeam.branch.codigo,
    Area: w.branchTeam.areaNegocio === "ventas" ? "Ventas" : "Postventa",
    Activo: w.activo ? "Si" : "No",
    Virtual: w.esVirtual ? "Si" : "No",
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(workersData), "Trabajadores");

  const supervisorsData = supervisors.map((s) => ({
    Nombre: s.nombre,
    Email: s.email ?? "",
    Sucursales: s.branches.map((b) => b.branch.nombre).join(", "),
    Activo: s.activo ? "Si" : "No",
    "Login habilitado": s.email && s.passwordHash ? "Si" : "No",
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(supervisorsData), "Supervisores");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="teamplanner-export.xlsx"`,
    },
  });
}
