import { prisma } from "@/lib/db/prisma";
import SupervisoresClient from "./SupervisoresClient";

export const dynamic = "force-dynamic";

export interface BranchInfo {
  id: string;
  nombre: string;
  codigo: string;
}

export interface SupervisorWithBranches {
  id: string;
  nombre: string;
  email: string | null;
  activo: boolean;
  passwordHash: string | null;
  createdAt: Date;
  branches: { branch: BranchInfo }[];
}

export default async function SupervisoresPage() {
  const [supervisors, branches] = await Promise.all([
    prisma.supervisor.findMany({
      include: {
        branches: {
          include: {
            branch: { select: { id: true, nombre: true, codigo: true } },
          },
        },
      },
      orderBy: { nombre: "asc" },
    }),
    prisma.branch.findMany({
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, codigo: true },
    }),
  ]);

  return (
    <SupervisoresClient
      initialSupervisors={supervisors as SupervisorWithBranches[]}
      branches={branches}
    />
  );
}
