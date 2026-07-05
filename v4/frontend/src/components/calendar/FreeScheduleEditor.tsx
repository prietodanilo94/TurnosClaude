"use client";

// F11 — editor de horario libre (jefes de sucursal y admins). Fila =
// trabajador, sin slots visibles. El estado se materializa al modelo
// Calendar al guardar (un POST por equipo), heredando export RRHH, F10 y
// validacion. Ver v4/specs/F11-horario-libre/spec.md.
import { useEffect, useMemo, useRef, useState } from "react";
import type { DayShift, WorkerBlockInfo } from "@/types";
import { buildIsoWeeks, MONTH_NAMES } from "@/app/admin/sucursales/[id]/calendario/[year]/[month]/calendar-utils";
import { CalendarValidationPanel, buildValidationSummary } from "@/app/admin/sucursales/[id]/calendario/[year]/[month]/ValidationPanel";
import { validateCalendarForPublish, MAX_SHIFT_WORKED_HOURS, SHIFT_WINDOW_START, SHIFT_WINDOW_END, type PrevMonthShiftsMap } from "@/lib/calendar/validation";
import { buildWorkerBlockDateMap } from "@/lib/calendar/generator";
import { fmt, isFeriadoIrrenunciable, shiftDuration } from "@/lib/calendar/calendar-utils";
import {
  applyToCells, copyRow, diffStates, materializeTeam, setCell,
  rowFreeSundays, rowMaxRun, rowWeekHours, weekdayDatesOfMonth,
  type FreeScheduleState,
} from "@/lib/calendar/freeSchedule";

const DOW_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const PRESETS: DayShift[] = [
  { start: "09:00", end: "18:30" },
  { start: "10:00", end: "19:00" },
  { start: "10:00", end: "20:00" },
  { start: "11:00", end: "20:00" },
];

type Brush = { kind: "shift"; shift: DayShift } | { kind: "erase" };

export interface FreeTeamInput {
  teamId: string;
  label?: string; // nombre de sucursal (visible en grupos)
  workers: { id: string; nombre: string }[]; // nombre asc
}

interface Props {
  teams: FreeTeamInput[];
  year: number;
  month: number;
  savedState: FreeScheduleState; // baseline guardado actual (cualquier origen)
  savedOrigen: "libre" | null;
  hasCalendar: boolean;
  scopeLabel: string;
  scopeType: "branch" | "group";
  prevMonthShifts?: PrevMonthShiftsMap;
  workerBlocks?: WorkerBlockInfo[];
  isAdmin: boolean;
}

function shiftLabel(s: DayShift) {
  return `${s.start}–${s.end}`;
}

export default function FreeScheduleEditor({
  teams, year, month, savedState, savedOrigen, hasCalendar,
  scopeLabel, scopeType, prevMonthShifts, workerBlocks = [], isAdmin,
}: Props) {
  const allWorkers = useMemo(
    () => teams.flatMap((t) => t.workers.map((w) => ({ ...w, teamId: t.teamId, teamLabel: t.label }))),
    [teams],
  );
  const workerNames = useMemo(
    () => Object.fromEntries(allWorkers.map((w) => [w.id, w.nombre])),
    [allWorkers],
  );

  const [state, setState] = useState<FreeScheduleState>(() => (savedOrigen === "libre" ? savedState : {}));
  const [brush, setBrush] = useState<Brush>({ kind: "shift", shift: PRESETS[1] });
  const [customStart, setCustomStart] = useState("10:00");
  const [customEnd, setCustomEnd] = useState("19:00");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error" | "warning"; text: string } | null>(null);

  const baselineRef = useRef<FreeScheduleState>(savedState);
  const [savedOrigenLocal, setSavedOrigenLocal] = useState(savedOrigen);
  const [hasCalendarLocal, setHasCalendarLocal] = useState(hasCalendar);
  const undoRef = useRef<FreeScheduleState[]>([]);
  const paintingRef = useRef(false);

  const weeks = useMemo(() => buildIsoWeeks(year, month), [year, month]);
  const gridDates = useMemo(() => weeks.flat().map(fmt), [weeks]);
  const monthStartStr = `${year}-${String(month).padStart(2, "0")}-01`;
  const todayStr = fmt(new Date());
  const monthName = MONTH_NAMES[month];
  const sundays = useMemo(
    () => gridDates.filter((d) => d.startsWith(monthStartStr.slice(0, 8)) && new Date(d + "T12:00:00").getDay() === 0),
    [gridDates, monthStartStr],
  );
  const blockMap = useMemo(() => buildWorkerBlockDateMap(workerBlocks), [workerBlocks]);

  // ─── validacion en vivo ────────────────────────────────────────────────────
  const validation = useMemo(() => {
    const { slots, assignments } = materializeTeam(state, allWorkers, gridDates);
    return validateCalendarForPublish({
      year, month, slots, assignments,
      workerMap: workerNames, blockMap, prevMonthShifts, todayStr,
    });
  }, [state, allWorkers, gridDates, year, month, workerNames, blockMap, prevMonthShifts, todayStr]);

  // Celdas con problema puntual (issues con slotNumber + fecha): slot i+1 = worker i.
  const issueCells = useMemo(() => {
    const set = new Set<string>();
    for (const issue of validation.issues) {
      if (issue.slotNumber && issue.dateStr) {
        const worker = allWorkers[issue.slotNumber - 1];
        if (worker) set.add(`${worker.id}:${issue.dateStr}`);
      }
    }
    return set;
  }, [validation, allWorkers]);

  // Errores legales bloquean el guardado. Excepcion: weekly_hours_high de
  // semanas ya transcurridas (no corregibles) no bloquea — eso lo decide
  // exceeds42hLimit, que ya viene suavizado con todayStr desde validation.ts.
  const blockingSave =
    validation.exceeds42hLimit ||
    validation.errors.some((e) => e.code !== "weekly_hours_high");

  const monthPrefix = monthStartStr.slice(0, 8);
  const workersWithoutShifts = allWorkers.filter(
    (w) => !Object.keys(state[w.id] ?? {}).some((d) => d.startsWith(monthPrefix)),
  );
  const paintedCount = allWorkers.reduce(
    (sum, w) => sum + Object.keys(state[w.id] ?? {}).filter((d) => d.startsWith(monthPrefix)).length,
    0,
  );

  // ─── edicion ───────────────────────────────────────────────────────────────
  function inMonth(dateStr: string) {
    return dateStr.startsWith(monthPrefix);
  }
  function canPaint(dateStr: string) {
    if (!inMonth(dateStr)) return false;
    if (isFeriadoIrrenunciable(new Date(dateStr + "T12:00:00"))) return false;
    if (!isAdmin && dateStr < todayStr) return false;
    return true;
  }
  function isBlocked(workerId: string, dateStr: string) {
    return blockMap[workerId]?.[dateStr] !== undefined;
  }

  function pushUndo() {
    undoRef.current.push(state);
    if (undoRef.current.length > 50) undoRef.current.shift();
  }
  function undo() {
    const prev = undoRef.current.pop();
    if (prev) { setState(prev); setDirty(true); }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
    }
    function onMouseUp() { paintingRef.current = false; }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mouseup", onMouseUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function brushShift(): DayShift | null {
    return brush.kind === "erase" ? null : brush.shift;
  }

  function paintCell(workerId: string, dateStr: string) {
    if (!canPaint(dateStr) || isBlocked(workerId, dateStr)) return;
    setState((s) => setCell(s, workerId, dateStr, brushShift()));
    setDirty(true);
  }

  function handleCellMouseDown(workerId: string, dateStr: string) {
    if (!canPaint(dateStr) || isBlocked(workerId, dateStr)) return;
    pushUndo();
    paintingRef.current = true;
    paintCell(workerId, dateStr);
  }
  function handleCellMouseEnter(workerId: string, dateStr: string) {
    if (paintingRef.current) paintCell(workerId, dateStr);
  }

  function applyBrushToWeekday(dow: number, clear = false) {
    pushUndo();
    const dates = weekdayDatesOfMonth(year, month, dow).filter(canPaint);
    const cells = allWorkers.flatMap((w) =>
      dates.filter((d) => !isBlocked(w.id, d)).map((d) => ({ workerId: w.id, dateStr: d })),
    );
    setState((s) => applyToCells(s, cells, clear ? null : brushShift()));
    setDirty(true);
  }

  function copyPrevWeek(weekIdx: number) {
    if (weekIdx <= 0) return;
    pushUndo();
    const fromDates = weeks[weekIdx - 1].map(fmt);
    const toDates = weeks[weekIdx].map(fmt);
    setState((s) => {
      let next = s;
      for (const w of allWorkers) {
        for (let i = 0; i < 7; i++) {
          if (!canPaint(toDates[i]) || isBlocked(w.id, toDates[i])) continue;
          next = setCell(next, w.id, toDates[i], s[w.id]?.[fromDates[i]] ?? null);
        }
      }
      return next;
    });
    setDirty(true);
  }

  function repeatFirstWeek() {
    pushUndo();
    const fromDates = weeks[0].map(fmt);
    setState((s) => {
      let next = s;
      for (let wi = 1; wi < weeks.length; wi++) {
        const toDates = weeks[wi].map(fmt);
        for (const w of allWorkers) {
          for (let i = 0; i < 7; i++) {
            if (!canPaint(toDates[i]) || isBlocked(w.id, toDates[i])) continue;
            next = setCell(next, w.id, toDates[i], s[w.id]?.[fromDates[i]] ?? null);
          }
        }
      }
      return next;
    });
    setDirty(true);
  }

  function clearWeek(weekIdx: number) {
    pushUndo();
    const dates = weeks[weekIdx].map(fmt).filter(canPaint);
    const cells = allWorkers.flatMap((w) =>
      dates.filter((d) => !isBlocked(w.id, d)).map((d) => ({ workerId: w.id, dateStr: d })),
    );
    setState((s) => applyToCells(s, cells, null));
    setDirty(true);
  }

  function copyRowFrom(fromWorkerId: string, toWorkerId: string) {
    pushUndo();
    const dates = gridDates.filter((d) => canPaint(d) && !isBlocked(toWorkerId, d));
    setState((s) => copyRow(s, fromWorkerId, toWorkerId, dates));
    setDirty(true);
  }

  function clearRowFor(workerId: string) {
    pushUndo();
    const cells = gridDates
      .filter((d) => canPaint(d) && !isBlocked(workerId, d))
      .map((d) => ({ workerId, dateStr: d }));
    setState((s) => applyToCells(s, cells, null));
    setDirty(true);
  }

  const customWorked = shiftDuration({ start: customStart, end: customEnd });
  const customValid =
    customStart >= SHIFT_WINDOW_START && customEnd <= SHIFT_WINDOW_END &&
    customStart < customEnd && customWorked <= MAX_SHIFT_WORKED_HOURS && customWorked > 0;

  // ─── guardado ──────────────────────────────────────────────────────────────
  async function handleSave() {
    setFeedback(null);
    if (blockingSave) {
      setFeedback({ tone: "error", text: "No se puede guardar: hay reglas legales sin cumplir. Revisa el panel de problemas." });
      return;
    }
    if (workersWithoutShifts.length > 0) {
      const names = workersWithoutShifts.slice(0, 5).map((w) => `• ${w.nombre}`).join("\n");
      const more = workersWithoutShifts.length > 5 ? `\n• y ${workersWithoutShifts.length - 5} más` : "";
      if (!confirm(`Horario incompleto: ${workersWithoutShifts.length} trabajador${workersWithoutShifts.length !== 1 ? "es" : ""} sin ningún turno pintado:\n\n${names}${more}\n\n¿Guardar así de todos modos?`)) return;
    }
    if (hasCalendarLocal && savedOrigenLocal !== "libre") {
      if (!confirm(`Ya tienes un horario ROTATIVO guardado para ${monthName} ${year}.\n\nSi guardas, este horario libre pasará a ser el horario oficial y reemplazará al rotativo.\n\n¿Continuar?`)) return;
    }

    setSaving(true);
    try {
      const summary = buildValidationSummary(validation);
      for (const team of teams) {
        const { slots, assignments } = materializeTeam(state, team.workers, gridDates);
        const res = await fetch("/api/calendars", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teamId: team.teamId, year, month,
            slotsData: slots, assignments,
            origen: "libre",
            validationSummary: summary,
            scopeLabel, scopeType,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Error al guardar el horario");
        }
      }

      const changes = hasCalendarLocal
        ? diffStates(baselineRef.current, state, workerNames, year, month)
        : undefined;
      void fetch("/api/calendars/save-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamIds: teams.map((t) => t.teamId),
          year, month, scopeLabel, scopeType,
          changes: changes ?? null,
        }),
      });

      baselineRef.current = state;
      setHasCalendarLocal(true);
      setSavedOrigenLocal("libre");
      setDirty(false);
      setFeedback({ tone: "success", text: `${scopeLabel}: horario libre guardado como horario oficial de ${monthName} ${year}.` });
    } catch (err) {
      setFeedback({ tone: "error", text: err instanceof Error ? err.message : "Error al guardar" });
    } finally {
      setSaving(false);
    }
  }

  // ─── render ────────────────────────────────────────────────────────────────
  const isGroup = teams.length > 1;

  return (
    <div className="p-6 space-y-4" style={{ userSelect: paintingRef.current ? "none" : undefined }}>
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Horario libre — {scopeLabel}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {monthName} {year} · {allWorkers.length} trabajador{allWorkers.length !== 1 ? "es" : ""} · {paintedCount} turno{paintedCount !== 1 ? "s" : ""} pintado{paintedCount !== 1 ? "s" : ""}
            {savedOrigenLocal !== "libre" && hasCalendarLocal && (
              <span className="ml-2 text-amber-600">El horario oficial actual es rotativo — esto es un borrador hasta que guardes.</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={undoRef.current.length === 0}
            className="px-3 py-1.5 text-sm border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50 disabled:opacity-40"
            title="Deshacer (Ctrl+Z)"
          >
            ↶ Deshacer
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || paintedCount === 0 || !dirty}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Guardando..." : dirty ? "Guardar" : hasCalendarLocal && savedOrigenLocal === "libre" ? "Guardado" : "Guardar"}
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`text-sm rounded-md px-3 py-2 border ${
          feedback.tone === "success" ? "bg-green-50 border-green-200 text-green-800"
          : feedback.tone === "error" ? "bg-red-50 border-red-200 text-red-700"
          : "bg-amber-50 border-amber-200 text-amber-800"
        }`}>{feedback.text}</div>
      )}

      {/* Paleta de pinceles */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-500">Pincel:</span>
          {PRESETS.map((p) => {
            const active = brush.kind === "shift" && brush.shift.start === p.start && brush.shift.end === p.end;
            return (
              <button
                key={shiftLabel(p)}
                type="button"
                onClick={() => setBrush({ kind: "shift", shift: p })}
                className={`px-2.5 py-1 rounded text-xs font-mono border transition-colors ${
                  active ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100"
                }`}
              >
                {shiftLabel(p)}
              </button>
            );
          })}
          <span className="flex items-center gap-1 text-xs">
            <input type="time" value={customStart} min={SHIFT_WINDOW_START} max={SHIFT_WINDOW_END}
              onChange={(e) => setCustomStart(e.target.value)} className="px-1 py-0.5 border border-gray-300 rounded text-xs" />
            <span className="text-gray-400">a</span>
            <input type="time" value={customEnd} min={SHIFT_WINDOW_START} max={SHIFT_WINDOW_END}
              onChange={(e) => setCustomEnd(e.target.value)} className="px-1 py-0.5 border border-gray-300 rounded text-xs" />
            <button
              type="button"
              disabled={!customValid}
              onClick={() => setBrush({ kind: "shift", shift: { start: customStart, end: customEnd } })}
              className={`px-2 py-1 rounded text-xs border ${
                brush.kind === "shift" && brush.shift.start === customStart && brush.shift.end === customEnd && !PRESETS.some((p) => p.start === customStart && p.end === customEnd)
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
              }`}
            >
              Usar
            </button>
            {!customValid && (
              <span className="text-[10px] text-red-500">
                {customWorked > MAX_SHIFT_WORKED_HOURS ? `Máx ${MAX_SHIFT_WORKED_HOURS}h trabajadas` : `Ventana ${SHIFT_WINDOW_START}–${SHIFT_WINDOW_END}`}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => setBrush({ kind: "erase" })}
            className={`px-2.5 py-1 rounded text-xs border transition-colors ${
              brush.kind === "erase" ? "bg-gray-700 text-white border-gray-700" : "bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100"
            }`}
          >
            ⌫ Borrador
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="font-medium text-gray-500">Aplicar pincel a todos los:</span>
          {DOW_LABELS.map((label, dow) => (
            <button
              key={label}
              type="button"
              onClick={() => applyBrushToWeekday(dow)}
              className="px-2 py-0.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
            >
              {label}
            </button>
          ))}
          <span className="text-gray-300">·</span>
          <button
            type="button"
            onClick={repeatFirstWeek}
            className="px-2 py-0.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
          >
            Repetir semana 1 en todo el mes
          </button>
          <span className="text-gray-400 ml-auto hidden md:inline">
            Click o arrastra sobre las celdas para pintar · Ctrl+Z deshace
          </span>
        </div>
      </div>

      <CalendarValidationPanel validation={validation} />

      {/* Grilla por semanas */}
      <div className="space-y-4">
        {weeks.map((week, wi) => {
          const weekDates = week.map(fmt);
          return (
            <div key={wi} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between bg-blue-50 border-b border-gray-200 px-3 py-1.5">
                <span className="text-xs font-medium text-blue-900">
                  Semana {wi + 1} · {week[0].getDate()}/{week[0].getMonth() + 1} – {week[6].getDate()}/{week[6].getMonth() + 1}
                </span>
                <span className="flex items-center gap-2">
                  {wi > 0 && (
                    <button type="button" onClick={() => copyPrevWeek(wi)}
                      className="text-[11px] text-blue-600 hover:underline">⧉ Copiar semana anterior</button>
                  )}
                  <button type="button" onClick={() => clearWeek(wi)}
                    className="text-[11px] text-gray-400 hover:text-gray-600">✕ Limpiar semana</button>
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-3 py-1.5 font-medium text-gray-500 min-w-[180px]">Trabajador</th>
                      {week.map((d, di) => {
                        const dateStr = weekDates[di];
                        const feriado = isFeriadoIrrenunciable(d);
                        return (
                          <th key={di} className={`px-1 py-1.5 font-medium text-center w-[92px] ${
                            !inMonth(dateStr) ? "text-gray-300"
                            : feriado ? "text-red-500"
                            : di >= 5 ? "text-amber-700" : "text-gray-500"
                          }`}>
                            {DOW_LABELS[di]} {d.getDate()}
                            {feriado && <span className="block text-[9px]">feriado irr.</span>}
                          </th>
                        );
                      })}
                      <th className="px-2 py-1.5 font-medium text-gray-500 text-right w-16">Hrs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allWorkers.map((worker) => {
                      const prevTail = prevMonthShifts?.[worker.id];
                      const hrs = rowWeekHours(state, worker.id, weekDates, monthStartStr, prevTail);
                      const run = rowMaxRun(state, worker.id, monthStartStr, prevTail);
                      const freeSun = rowFreeSundays(state, worker.id, sundays);
                      return (
                        <tr key={worker.id} className="border-b border-gray-100 last:border-b-0">
                          <td className="px-3 py-1">
                            <div className="font-medium text-gray-800 truncate max-w-[200px]">
                              {worker.nombre}
                              {isGroup && worker.teamLabel && (
                                <span className="ml-1 text-[9px] text-gray-400">{worker.teamLabel}</span>
                              )}
                            </div>
                            {wi === 0 && (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`text-[9px] px-1 rounded ${run > 6 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>
                                  racha {run}
                                </span>
                                <span className={`text-[9px] px-1 rounded ${freeSun < 2 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>
                                  {freeSun} dom libre{freeSun !== 1 ? "s" : ""}
                                </span>
                                <select
                                  value=""
                                  onChange={(e) => { if (e.target.value) copyRowFrom(e.target.value, worker.id); }}
                                  className="text-[9px] text-gray-400 border-0 bg-transparent cursor-pointer max-w-[80px]"
                                  title="Copiar el horario completo de otro trabajador"
                                >
                                  <option value="">⧉ copiar de…</option>
                                  {allWorkers.filter((w) => w.id !== worker.id).map((w) => (
                                    <option key={w.id} value={w.id}>{w.nombre}</option>
                                  ))}
                                </select>
                                <button type="button" onClick={() => clearRowFor(worker.id)}
                                  className="text-[9px] text-gray-300 hover:text-red-500" title="Limpiar toda la fila">✕</button>
                              </div>
                            )}
                          </td>
                          {weekDates.map((dateStr, di) => {
                            const shift = state[worker.id]?.[dateStr] ?? null;
                            const paintable = canPaint(dateStr) && !isBlocked(worker.id, dateStr);
                            const blocked = isBlocked(worker.id, dateStr);
                            const hasIssue = issueCells.has(`${worker.id}:${dateStr}`);
                            return (
                              <td
                                key={di}
                                onMouseDown={() => handleCellMouseDown(worker.id, dateStr)}
                                onMouseEnter={() => handleCellMouseEnter(worker.id, dateStr)}
                                title={blocked ? `Bloqueado: ${blockMap[worker.id]?.[dateStr] ?? ""}` : undefined}
                                className={`px-1 py-1 text-center font-mono text-[10px] border-l border-gray-100 select-none ${
                                  !inMonth(dateStr) ? "bg-gray-50 text-gray-300"
                                  : blocked ? "bg-gray-200 text-gray-400"
                                  : !paintable ? "bg-gray-50 text-gray-400"
                                  : "cursor-pointer hover:ring-1 hover:ring-inset hover:ring-blue-300"
                                } ${hasIssue ? "ring-1 ring-inset ring-red-400 bg-red-50" : ""} ${
                                  shift && inMonth(dateStr) && !blocked ? (di >= 5 ? "bg-amber-50 text-amber-800" : "bg-green-50 text-green-800") : ""
                                }`}
                              >
                                {blocked ? "bloq." : shift ? shiftLabel(shift) : inMonth(dateStr) ? <span className="text-gray-300 italic">libre</span> : ""}
                              </td>
                            );
                          })}
                          <td className={`px-2 py-1 text-right font-mono ${hrs > 42 ? "text-red-600 font-bold" : "text-gray-500"}`}>
                            {hrs > 0 ? `${hrs}h` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-gray-400">
        Reglas aplicadas: máx 42h/semana · máx 6 días seguidos (considerando el mes anterior) · 2 domingos libres no consecutivos ·
        máx {MAX_SHIFT_WORKED_HOURS}h trabajadas por turno · ventana {SHIFT_WINDOW_START}–{SHIFT_WINDOW_END}.
        {!isAdmin && " Los días pasados no se pueden editar."}
      </p>
    </div>
  );
}
