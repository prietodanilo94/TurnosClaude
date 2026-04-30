import { prisma } from "@/lib/db/prisma";
import UsuariosClient from "./UsuariosClient";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const [users, branches] = await Promise.all([
    prisma.user.findMany({
      include: { branches: { include: { branch: { select: { id: true, nombre: true, codigo: true } } } } },
      orderBy: { nombre: "asc" },
    }),
    prisma.branch.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true, codigo: true } }),
  ]);

  return <UsuariosClient initialUsers={users as UserWithBranches[]} branches={branches} />;
}

export interface BranchInfo { id: string; nombre: string; codigo: string; }
export interface UserWithBranches {
  id: string;
  email: string;
  nombre: string;
  activo: boolean;
  createdAt: Date;
  branches: { branch: BranchInfo }[];
}
