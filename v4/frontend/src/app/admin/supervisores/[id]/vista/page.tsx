import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import SupervisorBranchSelector, { type BranchInfo } from "@/app/supervisor/SupervisorBranchSelector";

interface Props {
  params: { id: string };
}

export const dynamic = "force-dynamic";

export default async function SupervisorVistaPage({ params }: Props) {
  await getSession();

  const supervisor = await prisma.supervisor.findUnique({
    where: { id: params.id },
    select: { id: true, nombre: true },
  });
  if (!supervisor) notFound();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const allBranches = await prisma.branch.findMany({
    where: { supervisors: { some: { supervisorId: params.id } } },
    orderBy: { nombre: "asc" },
    select: branchSelectorSelect(year, month),
  });

  const branchIds = allBranches.map((b) => b.id);
  const groupIds = [...new Set(allBranches.map((b) => b.groupId).filter(Boolean) as string[])];
  const branchSummaries = allBranches.map(summarizeBranch);
  const branchSummaryById = new Map(branchSummaries.map((b) => [b.id, b]));

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
      .map((b) => branchSummaryById.get(b.id))
      .filter((b): b is BranchInfo => Boolean(b)),
  }));
  const ungrouped = branchSummaries
    .filter((b) => !groupedBranchIds.has(b.id))
    .map(({ id, nombre, codigo, supervisors, status }) => ({ id, nombre, codigo, supervisors, status }));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/admin/supervisores" className="text-sm text-gray-500 hover:text-gray-700">
          ← Supervisores
        </Link>
      </div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Mis sucursales</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Viendo como: <span className="font-medium text-gray-600">{supervisor.nombre}</span>
        </p>
      </div>
      <SupervisorBranchSelector groups={preparedGroups} ungrouped={ungrouped} />
    </div>
  );
}

function branchSelectorSelect(year: number, month: number) {
  return {
    id: true,
    nombre: true,
    codigo: true,
    groupId: true,
    supervisors: { select: { supervisor: { select: { id: true, nombre: true } } } },
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
  supervisors: Array<{ supervisor: { id: string; nombre: string } }>;
  teams: Array<{
    categoria: string | null;
    workers: Array<{ id: string }>;
    calendars: Array<{ id: string }>;
  }>;
}): BranchInfo {
  const teamCount = branch.teams.length;
  const activeWorkerCount = branch.teams.reduce((sum, t) => sum + t.workers.length, 0);
  const missingCategory = teamCount === 0 || branch.teams.some((t) => !t.categoria);
  const hasCalendar = branch.teams.some((t) => t.calendars.length > 0);
  const issueCount = teamCount === 0 ? 1 : Number(missingCategory) + Number(activeWorkerCount === 0);

  return {
    id: branch.id,
    nombre: branch.nombre,
    codigo: branch.codigo,
    supervisors: branch.supervisors.map((s) => ({ id: s.supervisor.id, nombre: s.supervisor.nombre })),
    status: { teamCount, activeWorkerCount, missingCategory, hasCalendar, issueCount },
  };
}
