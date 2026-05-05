import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import SupervisorBranchSelector from "./SupervisorBranchSelector";

export const dynamic = "force-dynamic";

export default async function SupervisorHomePage() {
  const session = await getSession();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const branches =
    session?.role === "admin"
      ? await prisma.branch.findMany({
          orderBy: { nombre: "asc" },
          select: { id: true, nombre: true, codigo: true },
        })
      : session?.supervisorId
        ? await prisma.branch.findMany({
            where: { supervisors: { some: { supervisorId: session.supervisorId } } },
            orderBy: { nombre: "asc" },
            select: { id: true, nombre: true, codigo: true },
          })
        : await prisma.branch.findMany({
            where: { id: { in: session?.branchIds ?? [] } },
            orderBy: { nombre: "asc" },
            select: { id: true, nombre: true, codigo: true },
          });

  return (
    <div className="p-6">
      <SupervisorBranchSelector branches={branches} year={year} month={month} />
    </div>
  );
}
