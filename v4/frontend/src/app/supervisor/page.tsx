import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import SupervisorBranchSelector, { type BranchInfo } from "./SupervisorBranchSelector";

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
          select: branchSelectorSelect(year, month),
        })
      : session?.supervisorId
        ? await prisma.branch.findMany({
            where: { supervisors: { some: { supervisorId: session.supervisorId } } },
            orderBy: { nombre: "asc" },
            select: branchSelectorSelect(year, month),
          })
        : await prisma.branch.findMany({
            where: { id: { in: session?.branchIds ?? [] } },
            orderBy: { nombre: "asc" },
            select: branchSelectorSelect(year, month),
          });

  const branchIds = allBranches.map((b) => b.id);
  const groupIds = [...new Set(allBranches.map((b) => b.groupId).filter(Boolean) as string[])];
  const branchSummaries = allBranches.map(summarizeBranch);
  const branchSummaryById = new Map(branchSummaries.map((branch) => [branch.id, branch]));

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
  const preparedGroups = groups.map((group) => ({
    ...group,
    branches: group.branches
      .map((branch) => branchSummaryById.get(branch.id))
      .filter((branch): branch is BranchInfo => Boolean(branch)),
  }));
  const ungrouped = branchSummaries
    .filter((b) => !groupedBranchIds.has(b.id))
    .map(({ id, nombre, codigo, status }) => ({ id, nombre, codigo, status }));

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Mis sucursales</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Selecciona un grupo o sucursal individual para revisar, generar o corregir el calendario del mes actual.
        </p>
      </div>
      <SupervisorBranchSelector
        groups={preparedGroups}
        ungrouped={ungrouped}
      />
    </div>
  );
}

function branchSelectorSelect(year: number, month: number) {
  return {
    id: true,
    nombre: true,
    codigo: true,
    groupId: true,
    teams: {
      select: {
        categoria: true,
        workers: { where: { activo: true }, select: { id: true } },
        calendars: { where: { year, month }, select: { id: true } },
      },
    },
  } as const;
}

function summarizeBranch(branch: {
  id: string;
  nombre: string;
  codigo: string;
  teams: Array<{
    categoria: string | null;
    workers: Array<{ id: string }>;
    calendars: Array<{ id: string }>;
  }>;
}): BranchInfo {
  const teamCount = branch.teams.length;
  const activeWorkerCount = branch.teams.reduce((sum, team) => sum + team.workers.length, 0);
  const missingCategory = teamCount === 0 || branch.teams.some((team) => !team.categoria);
  const hasCalendar = branch.teams.some((team) => team.calendars.length > 0);
  const issueCount = teamCount === 0
    ? 1
    : Number(missingCategory) + Number(activeWorkerCount === 0);

  return {
    id: branch.id,
    nombre: branch.nombre,
    codigo: branch.codigo,
    status: {
      teamCount,
      activeWorkerCount,
      missingCategory,
      hasCalendar,
      issueCount,
    },
  };
}
