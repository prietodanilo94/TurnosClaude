import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import TrabajadoresClient from "./TrabajadoresClient";

export const dynamic = "force-dynamic";

export interface BranchTeamInfo {
  id: string;
  areaNegocio: string;
  branch: { id: string; nombre: string; codigo: string };
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

export default async function TrabajadoresPage() {
  await getSession();

  const [workers, branchTeams] = await Promise.all([
    prisma.worker.findMany({
      include: {
        branchTeam: {
          include: { branch: { select: { id: true, nombre: true, codigo: true } } },
        },
      },
      orderBy: [{ branchTeam: { branch: { nombre: "asc" } } }, { nombre: "asc" }],
    }),
    prisma.branchTeam.findMany({
      include: { branch: { select: { id: true, nombre: true, codigo: true } } },
      orderBy: { branch: { nombre: "asc" } },
    }),
  ]);

  return (
    <TrabajadoresClient
      initialWorkers={workers as WorkerWithTeam[]}
      branchTeams={branchTeams as BranchTeamInfo[]}
    />
  );
}
