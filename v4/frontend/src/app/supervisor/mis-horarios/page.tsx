import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import PatternBuilderClient from "./PatternBuilderClient";
import { parseRotationJson, parseWeeklyHoursJson } from "@/lib/db/schemas";

export const dynamic = "force-dynamic";

export default async function MisHorariosPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.supervisorId && session.role !== "admin") redirect("/supervisor");

  const supervisorId = session.supervisorId ?? null;

  const patterns = supervisorId
    ? await prisma.shiftPattern.findMany({
        where: { supervisorId },
        orderBy: { createdAt: "asc" },
      })
    : [];

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Mis horarios personalizados</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Crea plantillas de turno propias. Solo tú y tus sucursales las verán.
        </p>
      </div>
      <PatternBuilderClient
        initialPatterns={patterns.map((p) => ({
          id: p.id,
          label: p.label,
          areaNegocio: p.areaNegocio as "ventas" | "postventa",
          rotationWeeks: parseRotationJson(p.rotationJson),
          weeklyHours: parseWeeklyHoursJson(p.weeklyHoursJson),
        }))}
      />
    </div>
  );
}
