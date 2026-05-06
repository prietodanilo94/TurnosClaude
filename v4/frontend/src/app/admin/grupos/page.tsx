import { prisma } from "@/lib/db/prisma";
import GruposClient from "./GruposClient";

export const dynamic = "force-dynamic";

export default async function GruposPage() {
  const [groups, branches] = await Promise.all([
    prisma.branchGroup.findMany({
      include: { branches: { orderBy: { nombre: "asc" }, select: { id: true, nombre: true, codigo: true } } },
      orderBy: { nombre: "asc" },
    }),
    prisma.branch.findMany({
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, codigo: true, groupId: true },
    }),
  ]);

  return <GruposClient initialGroups={groups} branches={branches} />;
}
