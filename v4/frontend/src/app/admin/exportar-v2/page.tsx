import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import ExportarV2Client, { type WorkerRow, type WorkerEvent } from "./ExportarV2Client";

interface Props {
  searchParams: {
    from?: string;
    to?: string;
    branchId?: string;
    supervisorId?: string;
    worker?: string;
    onlyPending?: string;
    page?: string;
  };
}

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

interface RawChange {
  workerId: string;
  workerName: string;
  date: string;
  dayLabel: string;
  from: string | null;
  to: string | null;
}

interface ParsedLog {
  logId: string;
  savedAt: Date;
  savedBy: string;
  branchId: string;
  year: number;
  month: number;
  teamId: string;
  changes: RawChange[];
}

export default async function ExportarV2Page({ searchParams }: Props) {
  await getSession();

  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);

  // Resolve branchIds for supervisor filter
  let branchIdsForSupervisor: string[] | undefined;
  if (searchParams.supervisorId) {
    const links = await prisma.supervisorBranch.findMany({
      where: { supervisorId: searchParams.supervisorId },
      select: { branchId: true },
    });
    branchIdsForSupervisor = links.map((l) => l.branchId);
  }

  const branchIdFilter = branchIdsForSupervisor
    ? { in: branchIdsForSupervisor }
    : searchParams.branchId || undefined;

  // Fetch calendar.save logs in range
  const logs = await prisma.auditLog.findMany({
    where: {
      action: "calendar.save",
      branchId: branchIdFilter,
      createdAt: {
        gte: searchParams.from ? new Date(`${searchParams.from}T00:00:00`) : undefined,
        lte: searchParams.to   ? new Date(`${searchParams.to}T23:59:59`)   : undefined,
      },
    },
    select: {
      id: true,
      createdAt: true,
      userEmail: true,
      branchId: true,
      metadata: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Parse metadata and extract per-log data
  const parsedLogs: ParsedLog[] = [];
  for (const log of logs) {
    if (!log.metadata) continue;
    let meta: Record<string, unknown>;
    try { meta = JSON.parse(log.metadata); } catch { continue; }

    const rawChanges = Array.isArray(meta.changes)
      ? (meta.changes as RawChange[]).filter(c => typeof c.workerId === "string" && c.workerId)
      : [];
    if (rawChanges.length === 0) continue;

    const year   = typeof meta.year   === "number" ? meta.year   : null;
    const month  = typeof meta.month  === "number" ? meta.month  : null;
    const teamId = typeof meta.teamId === "string" ? meta.teamId
      : Array.isArray(meta.teamIds) && typeof meta.teamIds[0] === "string" ? meta.teamIds[0] as string
      : null;

    if (!year || !month || !teamId || !log.branchId) continue;

    parsedLogs.push({
      logId: log.id,
      savedAt: log.createdAt,
      savedBy: log.userEmail ?? "Sistema",
      branchId: log.branchId,
      year,
      month,
      teamId,
      changes: rawChanges,
    });
  }

  // Collect unique workerIds and calendar keys
  const workerIdSet = new Set<string>();
  const calendarKeySet = new Set<string>();
  for (const log of parsedLogs) {
    for (const c of log.changes) workerIdSet.add(c.workerId);
    calendarKeySet.add(`${log.teamId}:${log.year}:${log.month}`);
  }

  // Fetch worker records for RUT + current branch info
  const workers = workerIdSet.size > 0
    ? await prisma.worker.findMany({
        where: { id: { in: [...workerIdSet] } },
        select: {
          id: true,
          rut: true,
          branchTeam: {
            select: {
              areaNegocio: true,
              branch: { select: { nombre: true, codigo: true } },
            },
          },
        },
      })
    : [];
  const workerMap = Object.fromEntries(workers.map(w => [w.id, w]));

  // Fetch calendar lastExportedAt for each (teamId, year, month)
  interface CalKey { teamId: string; year: number; month: number }
  const calKeys: CalKey[] = [...calendarKeySet].map(k => {
    const [teamId, y, m] = k.split(":");
    return { teamId, year: Number(y), month: Number(m) };
  });

  const calendars = calKeys.length > 0
    ? await prisma.calendar.findMany({
        where: { OR: calKeys.map(k => ({ branchTeamId: k.teamId, year: k.year, month: k.month })) },
        select: { branchTeamId: true, year: true, month: true, lastExportedAt: true },
      })
    : [];
  const calMap = new Map<string, Date | null>(
    calendars.map(c => [`${c.branchTeamId}:${c.year}:${c.month}`, c.lastExportedAt ?? null])
  );

  // Build per-worker data grouped across all logs
  const workerDataMap = new Map<string, WorkerRow>();

  for (const log of parsedLogs) {
    const lastExportedAt = calMap.get(`${log.teamId}:${log.year}:${log.month}`) ?? null;
    const downloadedSinceChange = lastExportedAt ? lastExportedAt > log.savedAt : false;
    const calendarUrl = `/admin/sucursales/${log.branchId}/calendario/${log.year}/${log.month}?team=${log.teamId}`;

    // Group this log's changes by workerId
    const byWorker = new Map<string, RawChange[]>();
    for (const c of log.changes) {
      if (!byWorker.has(c.workerId)) byWorker.set(c.workerId, []);
      byWorker.get(c.workerId)!.push(c);
    }

    for (const [workerId, workerChanges] of byWorker) {
      const w = workerMap[workerId];
      const workerName = workerChanges[0].workerName;

      if (!workerDataMap.has(workerId)) {
        workerDataMap.set(workerId, {
          workerId,
          workerName,
          workerRut: w?.rut ?? "",
          branchNombre: w?.branchTeam?.branch?.nombre ?? "",
          branchCodigo: w?.branchTeam?.branch?.codigo ?? "",
          areaNegocio: w?.branchTeam?.areaNegocio ?? "",
          hasPending: false,
          events: [],
        });
      }

      const row = workerDataMap.get(workerId)!;

      const event: WorkerEvent = {
        logId: log.logId,
        savedAt: log.savedAt.toISOString(),
        savedBy: log.savedBy,
        year: log.year,
        month: log.month,
        calendarLastExportedAt: lastExportedAt?.toISOString() ?? null,
        downloadedSinceChange,
        calendarUrl,
        changes: workerChanges.map(c => ({
          date: c.date,
          dayLabel: c.dayLabel,
          from: c.from,
          to: c.to,
        })),
      };

      row.events.push(event);
      if (!downloadedSinceChange) row.hasPending = true;
    }
  }

  // Sort events per worker descending by savedAt
  for (const row of workerDataMap.values()) {
    row.events.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  // Build array sorted by workerName asc
  let allRows = [...workerDataMap.values()].sort((a, b) =>
    a.workerName.localeCompare(b.workerName, "es")
  );

  // Apply worker text filter
  const workerFilter = searchParams.worker?.toLowerCase().trim();
  if (workerFilter) {
    allRows = allRows.filter(r =>
      r.workerName.toLowerCase().includes(workerFilter) ||
      r.workerRut.toLowerCase().replace(/\./g, "").includes(workerFilter.replace(/\./g, ""))
    );
  }

  // Apply "solo pendientes" filter
  if (searchParams.onlyPending === "1") {
    allRows = allRows.filter(r => r.hasPending);
  }

  const total         = allRows.length;
  const totalPending  = allRows.filter(r => r.hasPending).length;
  const totalEvents   = allRows.reduce((s, r) => s + r.events.length, 0);
  const totalPages    = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows          = allRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const [branches, supervisors] = await Promise.all([
    prisma.branch.findMany({
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, codigo: true },
    }),
    prisma.supervisor.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
  ]);

  return (
    <ExportarV2Client
      rows={rows}
      total={total}
      totalPending={totalPending}
      totalEvents={totalEvents}
      page={page}
      totalPages={totalPages}
      branches={branches}
      supervisors={supervisors}
      filters={{
        from:         searchParams.from         ?? "",
        to:           searchParams.to           ?? "",
        branchId:     searchParams.branchId     ?? "",
        supervisorId: searchParams.supervisorId ?? "",
        worker:       searchParams.worker       ?? "",
        onlyPending:  searchParams.onlyPending  ?? "",
      }}
    />
  );
}
