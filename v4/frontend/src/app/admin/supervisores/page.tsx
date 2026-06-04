import { prisma } from "@/lib/db/prisma";
import SupervisoresClient from "./SupervisoresClient";

export const dynamic = "force-dynamic";

export interface BranchInfo {
  id: string;
  nombre: string;
  codigo: string;
  groupId: string | null;
  teamId: string | null;
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
            branch: {
              select: {
                id: true, nombre: true, codigo: true, groupId: true,
                teams: { select: { id: true }, take: 1 },
              }
            },
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

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  return (
    <SupervisoresClient
      initialSupervisors={supervisors as SupervisorWithBranches[]}
      branches={branches}
      year={year}
      month={month}
    />
  );
}
