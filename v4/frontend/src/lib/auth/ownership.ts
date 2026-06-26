import type { SessionPayload } from "./session";

/**
 * Verifica que la sesión tiene acceso a una sucursal específica.
 *
 * - admin: acceso total a todas las sucursales.
 * - supervisor con supervisorId: se consulta la DB para verificar la asignación.
 * - vendedor: nunca tiene acceso (nivel de ruta, no de branch).
 *
 * Retorna true si tiene acceso, false si no. No lanza — el caller decide la respuesta.
 *
 * NOTA: La verificación es lazy (per-request) porque los supervisors pueden tener
 * muchas sucursales y cargarlo todo en el JWT causaría cookie overflow (> 4KB).
 */
export async function assertBranchAccess(session: SessionPayload, branchId: string): Promise<boolean> {
  if (session.role === "admin") return true;
  if (session.role !== "supervisor" || !session.supervisorId) return false;

  const { prisma } = await import("@/lib/db/prisma");
  const link = await prisma.supervisorBranch.findUnique({
    where: {
      supervisorId_branchId: {
        supervisorId: session.supervisorId,
        branchId,
      },
    },
    select: { supervisorId: true },
  });

  return link !== null;
}

/**
 * Verifica acceso a un BranchTeam (equipo = branch + areaNegocio).
 * Resuelve el branchId del equipo y delega a assertBranchAccess.
 */
export async function assertTeamAccess(session: SessionPayload, teamId: string): Promise<boolean> {
  if (session.role === "admin") return true;
  if (session.role !== "supervisor" || !session.supervisorId) return false;

  const { prisma } = await import("@/lib/db/prisma");
  const team = await prisma.branchTeam.findUnique({
    where: { id: teamId },
    select: { branchId: true },
  });

  if (!team) return false;
  return assertBranchAccess(session, team.branchId);
}
