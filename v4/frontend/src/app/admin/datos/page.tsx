import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

async function getDataHealth() {
  const [
    supervisoresSinEmail,
    supervisoresSinPassword,
    supervisoresSinSucursales,
    sucursalesSinEquipo,
    equiposSinCategoria,
    equiposSinVendedores,
    grupos,
    calendariosSinAsignaciones,
  ] = await Promise.all([
    prisma.supervisor.findMany({
      where: { activo: true, email: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.supervisor.findMany({
      where: { activo: true, email: { not: null }, passwordHash: null },
      select: { id: true, nombre: true, email: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.supervisor.findMany({
      where: { activo: true, branches: { none: {} } },
      select: { id: true, nombre: true, email: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.branch.findMany({
      where: { teams: { none: {} } },
      select: { id: true, nombre: true, codigo: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.branchTeam.findMany({
      where: { categoria: null },
      select: { id: true, areaNegocio: true, branch: { select: { id: true, nombre: true } } },
      orderBy: { branch: { nombre: "asc" } },
    }),
    prisma.branchTeam.findMany({
      where: { workers: { none: { activo: true, esVirtual: false } } },
      select: { id: true, areaNegocio: true, branch: { select: { id: true, nombre: true } } },
      orderBy: { branch: { nombre: "asc" } },
    }),
    prisma.branchGroup.findMany({
      include: {
        branches: { include: { teams: { select: { areaNegocio: true, categoria: true } } } },
      },
    }),
    prisma.calendar.findMany({
      where: { assignedCount: 0 },
      select: {
        id: true, year: true, month: true,
        branchTeam: { select: { areaNegocio: true, branch: { select: { id: true, nombre: true } } } },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 30,
    }),
  ]);

  const gruposInconsistentes = grupos.filter((g) => {
    const allTeams = g.branches.flatMap((b) => b.teams);
    const byArea = new Map<string, Set<string>>();
    for (const t of allTeams) {
      if (!t.categoria) continue;
      const s = byArea.get(t.areaNegocio) ?? new Set();
      s.add(t.categoria);
      byArea.set(t.areaNegocio, s);
    }
    return [...byArea.values()].some((s) => s.size > 1);
  });

  return {
    supervisoresSinEmail,
    supervisoresSinPassword,
    supervisoresSinSucursales,
    sucursalesSinEquipo,
    equiposSinCategoria,
    equiposSinVendedores,
    gruposInconsistentes,
    calendariosSinAsignaciones,
  };
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const ok = count === 0;
  return (
    <div className={`rounded-lg border p-4 ${ok ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-gray-800">{title}</h2>
        <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${ok ? "bg-green-200 text-green-800" : "bg-amber-200 text-amber-800"}`}>
          {ok ? "OK" : count}
        </span>
      </div>
      {!ok && <div className="text-sm text-gray-700">{children}</div>}
    </div>
  );
}

export default async function DatosPage() {
  const data = await getDataHealth();

  const totalProblemas =
    data.supervisoresSinEmail.length +
    data.supervisoresSinPassword.length +
    data.supervisoresSinSucursales.length +
    data.sucursalesSinEquipo.length +
    data.equiposSinCategoria.length +
    data.equiposSinVendedores.length +
    data.gruposInconsistentes.length +
    data.calendariosSinAsignaciones.length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">← Admin</Link>
        <h1 className="text-xl font-bold text-gray-900">Salud de datos maestros</h1>
        {totalProblemas === 0 ? (
          <span className="ml-auto text-sm font-medium text-green-700 bg-green-100 px-3 py-1 rounded-full">
            Todo en orden
          </span>
        ) : (
          <span className="ml-auto text-sm font-medium text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
            {totalProblemas} {totalProblemas === 1 ? "problema" : "problemas"}
          </span>
        )}
      </div>

      <p className="text-sm text-gray-500 mb-6">
        Esta página detecta datos incompletos que pueden impedir el uso correcto de la app.
        Corrija cada ítem desde{" "}
        <Link href="/admin/supervisores" className="underline">Supervisores</Link>,{" "}
        <Link href="/admin/sucursales" className="underline">Sucursales</Link> o{" "}
        <Link href="/admin/categorias" className="underline">Categorías</Link>.
      </p>

      <div className="space-y-4">
        <Section title="Supervisores sin email" count={data.supervisoresSinEmail.length}>
          <ul className="list-disc pl-4 space-y-0.5">
            {data.supervisoresSinEmail.map((s) => (
              <li key={s.id}>
                <Link href={`/admin/supervisores`} className="hover:underline">{s.nombre}</Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Supervisores sin contraseña (nunca han ingresado)" count={data.supervisoresSinPassword.length}>
          <ul className="list-disc pl-4 space-y-0.5">
            {data.supervisoresSinPassword.map((s) => (
              <li key={s.id}>{s.nombre} — <span className="text-gray-500">{s.email}</span></li>
            ))}
          </ul>
        </Section>

        <Section title="Supervisores sin sucursales asignadas" count={data.supervisoresSinSucursales.length}>
          <ul className="list-disc pl-4 space-y-0.5">
            {data.supervisoresSinSucursales.map((s) => (
              <li key={s.id}>{s.nombre} {s.email && <span className="text-gray-500">({s.email})</span>}</li>
            ))}
          </ul>
        </Section>

        <Section title="Sucursales sin equipo configurado" count={data.sucursalesSinEquipo.length}>
          <ul className="list-disc pl-4 space-y-0.5">
            {data.sucursalesSinEquipo.map((b) => (
              <li key={b.id}>
                <Link href={`/admin/sucursales/${b.id}`} className="hover:underline">{b.nombre}</Link>
                <span className="text-gray-400 ml-1">({b.codigo})</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Equipos sin categoría asignada" count={data.equiposSinCategoria.length}>
          <p className="text-xs text-gray-500 mb-1">Sin categoría no se puede generar el calendario.</p>
          <ul className="list-disc pl-4 space-y-0.5">
            {data.equiposSinCategoria.map((t) => (
              <li key={t.id}>
                <Link href={`/admin/sucursales/${t.branch.id}`} className="hover:underline">{t.branch.nombre}</Link>
                <span className="text-gray-400 ml-1">({t.areaNegocio})</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Equipos sin vendedores activos" count={data.equiposSinVendedores.length}>
          <ul className="list-disc pl-4 space-y-0.5">
            {data.equiposSinVendedores.map((t) => (
              <li key={t.id}>
                <Link href={`/admin/sucursales/${t.branch.id}`} className="hover:underline">{t.branch.nombre}</Link>
                <span className="text-gray-400 ml-1">({t.areaNegocio})</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Grupos con categorías inconsistentes" count={data.gruposInconsistentes.length}>
          <p className="text-xs text-gray-500 mb-1">Sucursales del mismo grupo con distinta categoría para el mismo área.</p>
          <ul className="list-disc pl-4 space-y-0.5">
            {data.gruposInconsistentes.map((g) => (
              <li key={g.id}>{g.nombre}</li>
            ))}
          </ul>
        </Section>

        <Section title="Calendarios sin vendedores asignados" count={data.calendariosSinAsignaciones.length}>
          <p className="text-xs text-gray-500 mb-1">Calendarios generados pero sin asignaciones. Presione Regenerar para actualizar.</p>
          <ul className="list-disc pl-4 space-y-0.5">
            {data.calendariosSinAsignaciones.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/sucursales/${c.branchTeam.branch.id}/calendario/${c.year}/${c.month}`} className="hover:underline">
                  {c.branchTeam.branch.nombre} — {MONTH_NAMES[c.month]} {c.year}
                </Link>
                <span className="text-gray-400 ml-1">({c.branchTeam.areaNegocio})</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <p className="text-xs text-gray-400 mt-8">
        Esta página también está disponible como JSON en{" "}
        <code className="bg-gray-100 px-1 rounded">/api/admin/data-health</code>.
      </p>
    </div>
  );
}
