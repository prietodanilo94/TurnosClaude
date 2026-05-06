import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import SupervisorBranchSelector from "./SupervisorBranchSelector";

export const dynamic = "force-dynamic";

export default async function SupervisorHomePage() {
  const session = await getSession();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const allBranches =
    session?.role === "admin"
      ? await prisma.branch.findMany({
          orderBy: { nombre: "asc" },
          select: { id: true, nombre: true, codigo: true, groupId: true },
        })
      : session?.supervisorId
        ? await prisma.branch.findMany({
            where: { supervisors: { some: { supervisorId: session.supervisorId } } },
            orderBy: { nombre: "asc" },
            select: { id: true, nombre: true, codigo: true, groupId: true },
          })
        : await prisma.branch.findMany({
            where: { id: { in: session?.branchIds ?? [] } },
            orderBy: { nombre: "asc" },
            select: { id: true, nombre: true, codigo: true, groupId: true },
          });

  const branchIds = allBranches.map((b) => b.id);
  const groupIds = [...new Set(allBranches.map((b) => b.groupId).filter(Boolean) as string[])];

  const groups =
    groupIds.length > 0
      ? await prisma.branchGroup.findMany({
          where: { id: { in: groupIds } },
          include: {
            branches: {
              where: { id: { in: branchIds } },
              orderBy: { nombre: "asc" },
              select: { id: true, nombre: true, codigo: true },
            },
          },
          orderBy: { nombre: "asc" },
        })
      : [];

  const groupedBranchIds = new Set(groups.flatMap((g) => g.branches.map((b) => b.id)));
  const ungrouped = allBranches
    .filter((b) => !groupedBranchIds.has(b.id))
    .map(({ id, nombre, codigo }) => ({ id, nombre, codigo }));

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Mis sucursales</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Selecciona un grupo o sucursal individual para ver el calendario.
        </p>
      </div>
      <SupervisorBranchSelector
        groups={groups}
        ungrouped={ungrouped}
      />
    </div>
  );
}
