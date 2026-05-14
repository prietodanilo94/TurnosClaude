import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import TrabajadoresClient from "./TrabajadoresClient";

export const dynamic = "force-dynamic";

export interface BranchInfo {
  id: string;
  nombre: string;
  codigo: string;
  supervisors: { supervisor: { id: string; nombre: string } }[];
}

export interface BranchTeamInfo {
  id: string;
  areaNegocio: string;
  branch: BranchInfo;
}

export interface WorkerWithTeam {
  id: string;
  rut: string;
  nombre: string;
  activo: boolean;
  esVirtual: boolean;
  branchTeamId: string;
  branchTeam: BranchTeamInfo;
}

export default async function TrabajadoresPage({
  searchParams,
}: {
  searchParams: { supervisorId?: string };
}) {
  await getSession();

  const supervisorId = searchParams.supervisorId;

  let supervisorLabel: string | undefined;
  let branchIds: string[] | undefined;

  if (supervisorId) {
    const supervisor = await prisma.supervisor.findUnique({
      where: { id: supervisorId },
      select: { nombre: true, branches: { select: { branchId: true } } },
    });
    if (supervisor) {
      supervisorLabel = supervisor.nombre;
      branchIds = supervisor.branches.map((b) => b.branchId);
    }
  }

  const branchInclude = {
    select: {
      id: true,
      nombre: true,
      codigo: true,
      supervisors: {
        select: { supervisor: { select: { id: true, nombre: true } } },
      },
    },
  };

  const [workers, branchTeams] = await Promise.all([
    prisma.worker.findMany({
      where: branchIds ? { branchTeam: { branchId: { in: branchIds } } } : undefined,
      include: {
        branchTeam: { include: { branch: branchInclude } },
      },
      orderBy: [{ branchTeam: { branch: { nombre: "asc" } } }, { nombre: "asc" }],
    }),
    prisma.branchTeam.findMany({
      include: { branch: branchInclude },
      orderBy: { branch: { nombre: "asc" } },
    }),
  ]);

  return (
    <TrabajadoresClient
      initialWorkers={workers as WorkerWithTeam[]}
      branchTeams={branchTeams as BranchTeamInfo[]}
      supervisorLabel={supervisorLabel}
    />
  );
}
