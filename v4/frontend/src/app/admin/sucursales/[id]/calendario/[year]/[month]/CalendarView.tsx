"use client";

import { useState, useMemo, useEffect, useRef, Fragment } from "react";
import { useRouter } from "next/navigation";
import SemanaPicker from "@/components/calendar/SemanaPicker";
import type { CalendarSlot, DayShift, ShiftPatternDef, WeekPattern, WorkerInfo, WorkerBlockInfo } from "@/types";
import { getOperatingWindow, getScheduleBreakdown } from "@/lib/patterns/catalog";
import { buildWorkerBlockDateMap } from "@/lib/calendar/generator";
import { validateCalendarForPublish, type PrevMonthShiftsMap } from "@/lib/calendar/validation";
import {
  MONTH_NAMES, addMinutesToTime, buildIsoWeeks, detectSemanaForWeek, detectSemanaOffset,
  fmt, isFeriadoIrrenunciable, shiftDuration, validateConsecutiveDays, type AttendanceByRut,
} from "./calendar-utils";
import { CalendarValidationPanel, buildSaveSuccessFeedback, buildValidationSummary } from "./ValidationPanel";
import { computeCalendarDiff } from "@/lib/calendar/diff";
import { WeekBlock } from "./WeekBlock";
import { CoberturaDelMesView } from "./CoberturaDelMes";
import { VendedorTabView } from "./VendedorTab";
import { AssignDialog, ShiftEditDialog } from "./CalendarDialogs";

interface Props {
  branchId: string;
  branchName: string;
  branchCodigo: string;
  teamId: string;
  areaNegocio: "ventas" | "postventa";
  categoria: string;
  patternOverride?: ShiftPatternDef;
  year: number;
  month: number;
  slots: CalendarSlot[];
  assignments: Record<string, string | null>;
  workers: WorkerInfo[];
  workerMap: Record<string, string>;
  workerBlocks?: WorkerBlockInfo[];
  calendarId?: string;
  generateAlert?: string;
  prevMonthLabel?: string;
  prevAssignments?: Record<string, string | null>;
  // Cola real del mes anterior por trabajador (extractPrevMonthTail) — la
  // validacion la usa para rachas y horas de la semana frontera (F11 Fase 0).
  prevMonthShifts?: PrevMonthShiftsMap;
  nextAssignments?: Record<string, string | null>;
  currentYear?: number;
  currentMonth?: number;
  backHref?: string;
  backLabel?: string;
  onNavigate?: (year: number, month: number) => string;
  onSaveCalendar?: (payload: {
    teamId: string;
    year: number;
    month: number;
    slotsData: CalendarSlot[];
    assignments: Record<string, string | null>;
    validationSummary?: {
      errorCount: number;
      warningCount: number;
      warningCodes: string[];
    };
    scopeLabel?: string;
    scopeType?: "branch" | "group";
    id?: string;
  }) => Promise<string | null | void>;
  onRecalculateCalendar?: (payload: {
    year: number;
    month: number;
    currentSlots: CalendarSlot[];
    currentAssignments: Record<string, string | null>;
  }) => Promise<{
    slots: CalendarSlot[];
    assignments?: Record<string, string | null>;
    calendarId?: string;
  } | void>;
  onExportCalendar?: (mode: "calendar" | "rrhh") => Promise<void>;
  recalculateLabel?: string;
  recalculateConfirmMessage?: string;
  saveConfirmMessage?: string;
  changeRemindMessage?: string;
  showExportButtons?: boolean;
  hideExcelExport?: boolean;
  showValidationPanel?: boolean;
  enforceValidationBeforeSave?: boolean;
  calendarScopeLabel?: string;
  calendarScopeType?: "branch" | "group";
  supervisorNames?: string[];
  patternRotation?: WeekPattern[];
  isAdmin?: boolean;
}

export default function CalendarView({
  branchId, branchName, branchCodigo, teamId, areaNegocio, categoria, patternOverride,
  year, month, slots, assignments, workers, workerMap, calendarId, generateAlert,
  workerBlocks = [], prevMonthLabel, prevAssignments = {}, prevMonthShifts, nextAssignments = {}, currentYear, currentMonth,
  backHref = "/admin/sucursales",
  backLabel = "Sucursales",
  onNavigate,
  onSaveCalendar,
  onRecalculateCalendar,
  onExportCalendar,
  recalculateLabel,
  recalculateConfirmMessage,
  saveConfirmMessage,
  changeRemindMessage,
  showExportButtons = true,
  hideExcelExport = false,
  showValidationPanel = false,
  enforceValidationBeforeSave = false,
  calendarScopeLabel,
  calendarScopeType = "branch",
  supervisorNames,
  patternRotation,
  isAdmin = false,
}: Props) {
  const router = useRouter();
  const [localSlots, setLocalSlots] = useState<CalendarSlot[]>(() =>
    slots.map(s => ({ ...s, days: { ...s.days } }))
  );
  const [assign, setAssign] = useState<Record<string, string | null>>(assignments);
  const initialSlots = useRef<CalendarSlot[]>(slots);
  const initialAssignments = useRef<Record<string, string | null>>(assignments);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calId, setCalId] = useState(calendarId);
  const [dialogSlot, setDialogSlot] = useState<number | null>(null);
  const [shiftEditDialog, setShiftEditDialog] = useState<{ slotNum: number; dateStr: string } | null>(null);
  const [semanaPicker, setSemanaPicker] = useState<{ slotNum: number; weekIndex: number } | null>(null);
  const [workerSwapModal, setWorkerSwapModal] = useState<{
    slotA: number;
    slotB: number;
    weekDates: string[];
  } | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [changeReminded, setChangeReminded] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    message: string;
    yesLabel: string;
    noLabel: string;
    onYes: () => void;
    onNo: () => void;
  } | null>(null);

  function openConfirm(
    message: string,
    yesLabel: string,
    onYes: () => void,
    noLabel = "Cancelar",
    onNo?: () => void,
  ) {
    setConfirmModal({ message, yesLabel, noLabel, onYes, onNo: onNo ?? (() => setConfirmModal(null)) });
  }

  function tryChangeGated(action: () => void) {
    if (!changeRemindMessage || changeReminded || !calId) { action(); return; }
    openConfirm(
      changeRemindMessage,
      "Continuar",
      () => { setChangeReminded(true); setConfirmModal(null); action(); },
      "Cancelar",
      () => setConfirmModal(null),
    );
  }

  async function doSave(): Promise<string | null> {
    setSaving(true);
    try {
      if (onSaveCalendar) {
        const id = await onSaveCalendar({
          teamId, year, month,
          slotsData: localSlots,
          assignments: assign,
          validationSummary: buildValidationSummary(validation),
          scopeLabel: calendarScopeLabel ?? branchName,
          scopeType: calendarScopeType,
          id: calId,
        });
        if (id) setCalId(id);
        setDirty(false);
        setSaveFeedback(buildSaveSuccessFeedback(validation, calendarScopeLabel ?? branchName));
        return id ?? calId ?? "saved";
      }
      const res = await fetch("/api/calendars", {
        method: calId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId, year, month,
          slotsData: localSlots,
          assignments: assign,
          validationSummary: buildValidationSummary(validation),
          scopeLabel: calendarScopeLabel ?? branchName,
          scopeType: calendarScopeType,
          id: calId,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setCalId(d.id);
        setDirty(false);
        setSaveFeedback(buildSaveSuccessFeedback(validation, calendarScopeLabel ?? branchName));
        const changes = calId
          ? computeCalendarDiff(initialSlots.current, localSlots, initialAssignments.current, assign, workerMap, year, month)
          : undefined;
        // Actualizar la base de comparacion al estado recien guardado: sin esto,
        // guardar dos veces en la misma sesion (ej. click doble, o guardar de
        // nuevo sin cambios nuevos) recalcula el diff contra el estado con el
        // que se abrio la pagina y duplica los mismos cambios en el AuditLog.
        initialSlots.current = localSlots;
        initialAssignments.current = assign;
        void fetch("/api/calendars/save-notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teamIds: [teamId],
            year,
            month,
            scopeLabel: calendarScopeLabel ?? branchName,
            scopeType: calendarScopeType,
            changes: changes ?? null,
          }),
        });
        return d.id as string;
      }
      const data = await res.json().catch(() => ({}));
      setSaveFeedback({ tone: "error", text: data.error ?? "No se pudo guardar el calendario." });
      return null;
    } catch (error) {
      setSaveFeedback({ tone: "error", text: error instanceof Error ? error.message : "No se pudo guardar el calendario." });
      return null;
    } finally {
      setSaving(false);
    }
  }

  function requestSave(onComplete?: (id: string | null) => void) {
    if (validation.exceeds42hLimit) {
      setSaveFeedback({ tone: "error", text: "No se puede guardar: hay un slot con más de 42 horas en una semana. Ajusta los turnos antes de guardar." });
      onComplete?.(null);
      return;
    }
    if (enforceValidationBeforeSave && validation.errors.length > 0) {
      const sample = validation.errors.slice(0, 4).map((issue) => `• ${issue.title}`).join("\n");
      const hiddenCount = validation.errors.length - 4;
      const more = hiddenCount > 0 ? `\n• Y ${hiddenCount} problema${hiddenCount !== 1 ? "s" : ""} más` : "";
      openConfirm(
        `Este calendario tiene ${validation.errors.length} problema${validation.errors.length !== 1 ? "s" : ""}:\n\n${sample}${more}\n\n¿Guardarlo como versión incompleta?`,
        "Guardar incompleto",
        async () => {
          setConfirmModal(null);
          await logValidationAttempt("confirmed_incomplete_save");
          const id = await doSave();
          onComplete?.(id ?? null);
        },
        "Cancelar",
        async () => {
          setConfirmModal(null);
          await logValidationAttempt("cancelled");
          setSaveFeedback({ tone: "warning", text: "Guardado cancelado. Corrige los datos pendientes o guarda como versión incompleta cuando quieras dejar respaldo." });
          onComplete?.(null);
        },
      );
      return;
    }
    void doSave().then(id => onComplete?.(id ?? null));
  }
  const [saveFeedback, setSaveFeedback] = useState<{ tone: "success" | "warning" | "error"; text: string; details?: string[] } | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [view, setView] = useState<"mensual" | "vendedor" | "diario">("mensual");
  const [selectedSlots, setSelectedSlots] = useState<Set<number>>(
    () => new Set(slots.map((s) => s.slotNumber)),
  );

  const weeks = useMemo(() => buildIsoWeeks(year, month), [year, month]);
  const operatingWindow = useMemo(() => getOperatingWindow(categoria, patternOverride), [categoria, patternOverride]);
  const blockMap = useMemo(() => buildWorkerBlockDateMap(workerBlocks), [workerBlocks]);
  const todayStr = fmt(new Date());
  const validation = useMemo(
    () => validateCalendarForPublish({
      year,
      month,
      slots: localSlots,
      assignments: assign,
      workerMap,
      blockMap,
      prevMonthShifts,
      todayStr,
    }),
    [year, month, localSlots, assign, workerMap, blockMap, prevMonthShifts, todayStr],
  );

  // Rotativos: orden por semana de inicio (S1 arriba). Fijos: por horario de inicio dominante.
  // Este orden alimenta slotDisplayNum, así "Vendedor N" queda secuencial en pantalla.
  const sortedSlots = useMemo(() => {
    if (patternRotation && patternRotation.length > 1) {
      const off = (s: CalendarSlot) =>
        s.semanaOffset !== undefined
          ? s.semanaOffset
          : detectSemanaOffset(s, patternRotation, year, month);
      return [...localSlots].sort((a, b) => off(a) - off(b) || a.slotNumber - b.slotNumber);
    }
    function dominantStart(slot: CalendarSlot): string {
      const counts: Record<string, number> = {};
      for (const shift of Object.values(slot.days)) {
        if (shift) counts[shift.start] = (counts[shift.start] ?? 0) + 1;
      }
      const best = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
      return best ? best[0] : "99:99";
    }
    return [...localSlots].sort((a, b) => {
      const diff = dominantStart(a).localeCompare(dominantStart(b));
      return diff !== 0 ? diff : a.slotNumber - b.slotNumber;
    });
  }, [localSlots, patternRotation, year, month]);

  // Mapa slotNumber → número de display según orden de sortedSlots
  const slotDisplayNum = useMemo<Record<number, number>>(() => {
    const map: Record<number, number> = {};
    sortedSlots.forEach((s, i) => { map[s.slotNumber] = i + 1; });
    return map;
  }, [sortedSlots]);

  const workerRutMap = useMemo(
    () => Object.fromEntries(workers.map((w) => [w.id, w.rut])),
    [workers]
  );

  const [attendanceByRut, setAttendanceByRut] = useState<AttendanceByRut>({});
  useEffect(() => {
    fetch(`/api/attendance?teamId=${teamId}&year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((records: { rut: string; fecha: string; entrada: string | null; salida: string | null }[]) => {
        const byRut: AttendanceByRut = {};
        for (const r of records) {
          if (!byRut[r.rut]) byRut[r.rut] = {};
          byRut[r.rut][r.fecha] = { entrada: r.entrada, salida: r.salida };
        }
        setAttendanceByRut(byRut);
      })
      .catch(() => {});
  }, [teamId, year, month]);

  async function handleSave(): Promise<string | null> {
    if (saveConfirmMessage && !confirm(saveConfirmMessage)) return null;
    return new Promise<string | null>((resolve) => requestSave(resolve));
  }

  async function logValidationAttempt(outcome: "cancelled" | "confirmed_incomplete_save") {
    try {
      await fetch("/api/calendars/validation-attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          year,
          month,
          scopeLabel: calendarScopeLabel ?? branchName,
          scopeType: calendarScopeType,
          outcome,
          validationSummary: buildValidationSummary(validation),
        }),
      });
    } catch {
      // El historial no debe bloquear la operacion del calendario.
    }
  }

  function handleRecalcular() {
    const msg = recalculateConfirmMessage ?? (calId
      ? "Esto borrará todas las asignaciones de trabajadores de este mes y dejará los turnos vacíos. ¿Continuar?"
      : prevMonthLabel
        ? `Esto generará el calendario continuando desde ${prevMonthLabel}. Las asignaciones de trabajadores se mantendrán. ¿Continuar?`
        : "Esto generará el calendario y asignará vendedores en orden. ¿Continuar?");
    openConfirm(msg, "Continuar", async () => {
      setConfirmModal(null);
    const wasNoCalendar = !calId;
    setRecalculating(true);
    try {
      if (onRecalculateCalendar) {
        let result;
        try {
          result = await onRecalculateCalendar({
            year,
            month,
            currentSlots: localSlots,
            currentAssignments: assign,
          });
        } catch (e) {
          setSaveFeedback({ tone: "error", text: e instanceof Error ? e.message : "Error al regenerar el calendario" });
          return;
        }
        if (result) {
          const newSlots = result.slots.map((s) => ({ ...s, days: { ...s.days } }));
          setLocalSlots(newSlots);
          setSelectedSlots(new Set(newSlots.map((s) => s.slotNumber)));
          if (result.assignments) setAssign(result.assignments);
          if (result.calendarId !== undefined) setCalId(result.calendarId);
          setDirty(wasNoCalendar);
          setSaveFeedback({
            tone: "success",
            text: wasNoCalendar
              ? "Calendario generado. Revisa y presiona Guardar cuando estes listo."
              : "Asignaciones borradas. Asigna los trabajadores nuevamente.",
          });
        }
        return;
      }

      if (calId) await fetch(`/api/calendars?id=${calId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setRecalculating(false);
    }
    });
  }

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function handleNavigateAway(destination: string) {
    if (!dirty) { router.push(destination); return; }
    openConfirm(
      "¿Deseas guardar los cambios antes de salir?",
      "Guardar y salir",
      async () => {
        setConfirmModal(null);
        const id = await doSave();
        if (id) router.push(destination);
      },
      "Salir sin guardar",
      () => { setConfirmModal(null); router.push(destination); },
    );
  }

  function navigateTo(newYear: number, newMonth: number) {
    void handleNavigateAway(onNavigate ? onNavigate(newYear, newMonth) : `/admin/sucursales/${branchId}/calendario/${newYear}/${newMonth}?team=${teamId}`);
  }

  function handleAssign(slotNum: number, workerId: string | null) {
    tryChangeGated(() => {
      setAssign((prev) => ({ ...prev, [String(slotNum)]: workerId }));
      setDirty(true);
      setDialogSlot(null);
    });
  }

  function handleSemanaChange(
    slotNum: number,
    newOffset: number,
    scope: "month" | "fromWeek" = "month",
    fromWeekIndex = 0,
  ) {
    if (!patternRotation || patternRotation.length <= 1) return;
    const N = patternRotation.length;
    setSemanaPicker(null);
    // Lunes de la primera semana del grid (la semana que contiene el día 1 del mes)
    const firstOfMonth = new Date(year, month - 1, 1);
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(firstOfMonth.getDate() - ((firstOfMonth.getDay() + 6) % 7));
    gridStart.setHours(12, 0, 0, 0);
    const msWeek = 7 * 24 * 3600 * 1000;
    setLocalSlots((prev) =>
      prev.map((s) => {
        if (s.slotNumber !== slotNum) return s;
        const newDays: Record<string, DayShift | null> = {};
        for (const dateStr of Object.keys(s.days)) {
          const d = new Date(dateStr + "T12:00:00");
          const wi = Math.floor((d.getTime() - gridStart.getTime()) / msWeek);
          if (scope === "fromWeek" && wi < fromWeekIndex) {
            // Semanas anteriores quedan intactas
            newDays[dateStr] = s.days[dateStr];
            continue;
          }
          const dow = (d.getDay() + 6) % 7; // 0=Lun…6=Dom
          const base = scope === "fromWeek" ? newOffset + (wi - fromWeekIndex) : newOffset + wi;
          const semanaIndex = ((base % N) + N) % N;
          newDays[dateStr] = patternRotation[semanaIndex][dow];
        }
        // semanaOffset describe la semana 1 del mes; en cambios parciales se conserva
        const semanaOffset = scope === "fromWeek" && fromWeekIndex > 0 ? s.semanaOffset : newOffset;
        return { ...s, days: newDays, semanaOffset };
      }),
    );
    setDirty(true);
  }

  // Fechas destino segun alcance: "week" = solo ese dia (nombre historico),
  // "isoweek" = todos los dias de esa semana (solo los del mes actual),
  // "month" = todos los [mismo dia de semana] del mes.
  function scopeDates(dateStr: string, scope: "week" | "isoweek" | "month"): string[] {
    if (scope === "month") {
      const clickedDow = new Date(dateStr + "T12:00:00").getDay();
      return weeks.flat().filter(d => d.getMonth() + 1 === month && d.getDay() === clickedDow).map(d => fmt(d));
    }
    if (scope === "isoweek") {
      const week = weeks.find(w => w.some(d => fmt(d) === dateStr));
      return week ? week.filter(d => d.getMonth() + 1 === month).map(d => fmt(d)) : [dateStr];
    }
    return [dateStr];
  }

  function handleShiftSave(slotNum: number, dateStr: string, newShift: DayShift, redistributeDate?: string | null, scope: "week" | "isoweek" | "month" = "week") {
    tryChangeGated(() => {
      const monthDates: string[] = scopeDates(dateStr, scope);
      setLocalSlots(prev => prev.map(s => {
        if (s.slotNumber !== slotNum) return s;
        const newDays: Record<string, DayShift | null> = { ...s.days };
        for (const d of monthDates) {
          if (s.days[d] !== undefined) newDays[d] = newShift;
        }
        if (scope === "week" && redistributeDate) {
          const origShift = s.days[dateStr];
          if (origShift) {
            const target = s.days[redistributeDate];
            if (target) {
              const diffMins = Math.round((shiftDuration(origShift) - shiftDuration(newShift)) * 60);
              newDays[redistributeDate] = { ...target, end: addMinutesToTime(target.end, diffMins) };
            }
          }
        }
        return { ...s, days: newDays };
      }));
      setDirty(true);
      setShiftEditDialog(null);
    });
  }

  function handleSetShiftLibre(slotNum: number, dateStr: string, scope: "week" | "isoweek" | "month" = "week") {
    tryChangeGated(() => {
      const monthDates: string[] = scopeDates(dateStr, scope);
      setLocalSlots(prev => prev.map(s => {
        if (s.slotNumber !== slotNum) return s;
        const newDays: Record<string, DayShift | null> = { ...s.days };
        for (const d of monthDates) {
          if (s.days[d] !== undefined) newDays[d] = null;
        }
        return { ...s, days: newDays };
      }));
      setDirty(true);
      setShiftEditDialog(null);
    });
  }

  function handleWorkerSwap(slotA: number, slotB: number, weekDates: string[], scope: "week" | "month") {
    tryChangeGated(() => {
      if (scope === "month") {
        const wA = assign[String(slotA)] ?? null;
        const wB = assign[String(slotB)] ?? null;
        setAssign(prev => ({ ...prev, [String(slotA)]: wB, [String(slotB)]: wA }));
      } else {
        setLocalSlots(prev => {
          const daysA = prev.find(s => s.slotNumber === slotA)?.days ?? {};
          const daysB = prev.find(s => s.slotNumber === slotB)?.days ?? {};
          return prev.map(s => {
            if (s.slotNumber === slotA) {
              const newDays = { ...s.days };
              for (const d of weekDates) newDays[d] = daysB[d] ?? null;
              return { ...s, days: newDays };
            }
            if (s.slotNumber === slotB) {
              const newDays = { ...s.days };
              for (const d of weekDates) newDays[d] = daysA[d] ?? null;
              return { ...s, days: newDays };
            }
            return s;
          });
        });
      }
      setDirty(true);
      setWorkerSwapModal(null);
    });
  }

  function handleLibreSwap(slotNum: number, d1: string, d2: string) {
    const slot = localSlots.find(s => s.slotNumber === slotNum);
    if (!slot) return;
    const sh1 = slot.days[d1] ?? null;
    const sh2 = slot.days[d2] ?? null;
    if (sh1 === null && sh2 === null) return;

    // Bug 5: bloquear si la sucursal nunca opera ese día de la semana (e.g. domingo).
    // En horario libre no aplica: la plantilla original parte vacía, así que
    // ningún día "opera" — todos los días de la ventana son válidos.
    const targetDay = sh1 !== null ? d2 : d1; // el día que recibirá el turno
    const targetDow = new Date(targetDay + "T12:00:00").getDay();
    // Verifica si ALGÚN slot tiene turno en ALGUNA fecha con el mismo día de semana
    const branchOperatesOnTarget = categoria === "horario_libre" || slots.some(s =>
      Object.entries(s.days).some(([ds, shift]) =>
        shift != null && new Date(ds + "T12:00:00").getDay() === targetDow,
      ),
    );
    if (!branchOperatesOnTarget) {
      openConfirm(
        "Este día no es laborable según el patrón de turnos de la sucursal. No se puede mover un turno aquí.",
        "Entendido",
        () => setConfirmModal(null),
        "",
        () => setConfirmModal(null),
      );
      return;
    }

    const newDays: Record<string, DayShift | null> = { ...slot.days, [d1]: sh2, [d2]: sh1 };
    if (!validateConsecutiveDays(newDays)) {
      openConfirm(
        "Este cambio genera más de 6 días laborales consecutivos, lo cual no está permitido.",
        "Entendido",
        () => setConfirmModal(null),
        "",
        () => setConfirmModal(null),
      );
      return;
    }
    tryChangeGated(() => {
      setLocalSlots(prev => prev.map(s =>
        s.slotNumber !== slotNum ? s : { ...s, days: { ...s.days, [d1]: sh2, [d2]: sh1 } }
      ));
      setDirty(true);
    });
  }

  async function handleExport(mode: "calendar" | "rrhh") {
    if (validation.errors.length > 0) {
      // Detalle real de los problemas (con nombre y fecha), no solo el conteo.
      const sample = validation.errors.slice(0, 6).map((e) => `• ${e.title}`).join("\n");
      const more = validation.errors.length > 6 ? `\n• y ${validation.errors.length - 6} más` : "";
      if (isAdmin) {
        // Los admins pueden descargar igual: muchos errores son historicos e
        // incorregibles (ej. rachas de un cruce de mes ya trabajado) y RRHH
        // necesita el archivo de todas formas.
        const ok = confirm(
          `El calendario tiene ${validation.errors.length} problema${validation.errors.length !== 1 ? "s" : ""}:\n\n${sample}${more}\n\n¿Descargar de todos modos? (se guardará tal como está)`,
        );
        if (!ok) return;
      } else {
        const message = `Antes de exportar, corrige estos problemas del calendario:\n\n${sample}${more}`;
        setSaveFeedback({ tone: "warning", text: message });
        alert(message);
        return;
      }
    }

    if (mode === "rrhh") {
      const unassigned = localSlots.filter((s) => !assign[String(s.slotNumber)]);
      if (unassigned.length > 0) {
        // Las filas sin vendedor no llevan RUT y quedan fuera del Excel de
        // todas formas — para un admin basta avisar y dejar continuar.
        if (isAdmin) {
          if (!confirm(`Hay ${unassigned.length} fila(s) sin vendedor asignar — esas filas NO van en el Excel. ¿Descargar de todos modos?`)) return;
        } else {
          alert(`Hay ${unassigned.length} vendedor(es) sin asignar. Asigna todos los slots antes de exportar el Excel RRHH.`);
          return;
        }
      }
    }
    const id = await doSave();
    if (!id) return;
    if (onExportCalendar) {
      await onExportCalendar(mode);
      return;
    }
    window.open(`/api/calendars/export?teamId=${teamId}&year=${year}&month=${month}&mode=${mode}`, "_blank");
  }

  function toggleSlot(n: number) {
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });
  }

  const occupiedByOther = (slotNum: number): Set<string> => {
    const set = new Set<string>();
    for (const [k, v] of Object.entries(assign)) {
      if (Number(k) !== slotNum && v) set.add(v);
    }
    return set;
  };

  // Datos para ShiftEditDialog
  const shiftForEdit = shiftEditDialog
    ? (localSlots.find(s => s.slotNumber === shiftEditDialog.slotNum)?.days[shiftEditDialog.dateStr] ?? null)
    : null;
  const originalShiftForEdit = shiftEditDialog
    ? (slots.find(s => s.slotNumber === shiftEditDialog.slotNum)?.days[shiftEditDialog.dateStr] ?? null)
    : null;
  const weekForEdit = shiftEditDialog
    ? (weeks.find(w => w.some(d => fmt(d) === shiftEditDialog.dateStr)) ?? null)
    : null;
  const redistributeDays: Array<{ dateStr: string; shift: DayShift; d: Date }> =
    shiftEditDialog && weekForEdit
      ? (weekForEdit
          .map(d => ({
            dateStr: fmt(d),
            shift: localSlots.find(s => s.slotNumber === shiftEditDialog.slotNum)?.days[fmt(d)] ?? null,
            d,
          }))
          .filter((x): x is { dateStr: string; shift: DayShift; d: Date } =>
            x.dateStr !== shiftEditDialog.dateStr &&
            x.shift !== null &&
            !isFeriadoIrrenunciable(x.d) &&
            x.d.getMonth() + 1 === month
          ))
      : [];
  const saveButtonLabel = saving
    ? "Guardando..."
    : dirty && enforceValidationBeforeSave && validation.errors.length > 0
      ? "Guardar version incompleta"
      : dirty
        ? "Guardar"
        : calId ? "Guardado" : "Sin guardar";

  return (
    <div className="p-6">
      <div className="mb-1">
        <button onClick={() => void handleNavigateAway(backHref)} className="text-xs text-gray-400 hover:text-gray-600">
          ← {backLabel}
        </button>
      </div>

      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{branchName}</h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
            {getScheduleBreakdown(categoria, patternOverride).map(({ days, range }, i) => (
              <Fragment key={days}>
                {i > 0 && <span className="text-gray-300">·</span>}
                <span className="text-gray-600">{days}: <span className="font-medium text-gray-700">{range}</span></span>
              </Fragment>
            ))}
            {supervisorNames && supervisorNames.length > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-gray-500">
                  Supervisor{supervisorNames.length > 1 ? "es" : ""}: <span className="font-medium text-gray-700">{supervisorNames.join(", ")}</span>
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleRecalcular}
            disabled={recalculating}
            className="px-3 py-1.5 text-sm border border-rose-300 text-rose-700 rounded hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Regenerar plantilla limpia desde cero"
          >
            {recalculating ? "Generando…" : recalculateLabel ?? (calId ? "Limpiar" : prevMonthLabel ? `Continuar desde ${prevMonthLabel}` : "Generar")}
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving || !dirty}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              dirty ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-gray-300 text-gray-400 cursor-default"
            }`}
          >
            {saveButtonLabel}
          </button>
          {showExportButtons && (
            <>
              <button
                onClick={() => handleExport("calendar")}
                className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
              >
                Exportar Calendario
              </button>
              {!hideExcelExport && (
                <button
                  onClick={() => handleExport("rrhh")}
                  className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                >
                  Exportar Excel
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Barra: tabs + mes/año */}
      <div className="mb-4 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200">
          {(
            [
              { key: "mensual",  label: "📅 Calendario Mensual", n: "1", active: "border-blue-700 bg-blue-700 text-white",       inactive: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",     badge: "bg-blue-200 text-blue-800",   badgeActive: "bg-white/25 text-white" },
              { key: "vendedor", label: "👤 Turno por Vendedor",  n: "2", active: "border-violet-600 bg-violet-600 text-white",   inactive: "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100", badge: "bg-violet-200 text-violet-800", badgeActive: "bg-white/25 text-white" },
              { key: "diario",   label: "📊 Cobertura del Día",   n: "3", active: "border-emerald-600 bg-emerald-600 text-white", inactive: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100", badge: "bg-emerald-200 text-emerald-800", badgeActive: "bg-white/25 text-white" },
            ] as const
          ).map(({ key, label, n, active, inactive, badge, badgeActive }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`flex-1 relative flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-colors border-b-2 ${
                view === key ? active : inactive
              }`}
            >
              <span className={`absolute left-3 inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold shrink-0 ${
                view === key ? badgeActive : badge
              }`}>
                {n}
              </span>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5">

        <h2 className="text-base font-medium text-gray-700 ml-1">
          {MONTH_NAMES[month]} {year}
        </h2>

        <div className="ml-auto flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => navigateTo(year, Number(e.target.value))}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {MONTH_NAMES.slice(1).map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => navigateTo(Number(e.target.value), month)}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[year - 1, year, year + 1, year + 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        </div>
      </div>

      {generateAlert && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded p-3 text-xs text-yellow-800">
          {generateAlert}
        </div>
      )}

      {/* Contenido según tab */}
      {saveFeedback && (
        <div className={`mb-4 border rounded p-3 text-xs ${
          saveFeedback.tone === "success"
            ? "bg-green-50 border-green-200 text-green-800"
            : saveFeedback.tone === "warning"
              ? "bg-amber-50 border-amber-200 text-amber-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
        }`}>
          <span className="font-medium">{saveFeedback.text}</span>
          {saveFeedback.details && saveFeedback.details.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 list-none">
              {saveFeedback.details.map((d, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="shrink-0">•</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Panel oculto mientras el calendario esta intacto y su unico problema
          es estar vacio (horario libre recien abierto): mostrar un error rojo
          antes de que el usuario haga nada es ruido. */}
      {showValidationPanel && (dirty || validation.issues.some((i) => i.code !== "empty_calendar")) && (
        <CalendarValidationPanel validation={validation} />
      )}

      {view === "mensual" ? (
        <div className="space-y-4">
          {weeks.map((week, wi) => (
            <WeekBlock
              key={wi}
              week={week}
              month={currentMonth ?? month}
              slots={sortedSlots}
              assign={assign}
              prevAssignments={prevAssignments}
              nextAssignments={nextAssignments}
              workerMap={workerMap}
              blockMap={blockMap}
              slotDisplayNum={slotDisplayNum}
              onSlotClick={(n) => setDialogSlot(n)}
              selectedDay={selectedDay}
              onDayClick={(ds) => setSelectedDay((prev) => prev === ds ? null : ds)}
              onShiftCellClick={(slotNum, dateStr) => setShiftEditDialog({ slotNum, dateStr })}
              onLibreSwap={handleLibreSwap}
              onWorkerSwap={(slotA, slotB, weekDates) => setWorkerSwapModal({ slotA, slotB, weekDates })}
              lockedBefore={calId && !isAdmin ? todayStr : undefined}
              isAdmin={isAdmin}
              workerRutMap={workerRutMap}
              attendanceByRut={attendanceByRut}
              patternRotation={patternRotation}
              localSlots={localSlots}
              onSemanaPicker={(n, wi) => setSemanaPicker({ slotNum: n, weekIndex: wi })}
              year={year}
              weekIndex={wi}
            />
          ))}
        </div>
      ) : view === "vendedor" ? (
        <VendedorTabView
          year={year}
          month={month}
          weeks={weeks}
          slots={sortedSlots}
          assign={assign}
          workerMap={workerMap}
          blockMap={blockMap}
          slotDisplayNum={slotDisplayNum}
          selectedSlots={selectedSlots}
          onToggleSlot={toggleSlot}
          onSelectAll={() => setSelectedSlots(new Set(sortedSlots.map((s) => s.slotNumber)))}
          onDeselectAll={() => setSelectedSlots(new Set())}
          onSlotClick={(n) => tryChangeGated(() => { setDialogSlot(n); setSelectedDay(null); })}
          onShiftCellClick={(slotNum, dateStr) => setShiftEditDialog({ slotNum, dateStr })}
          onLibreSwap={handleLibreSwap}
          lockedBefore={calId && !isAdmin ? todayStr : undefined}
        />
      ) : (
        <CoberturaDelMesView
          year={year}
          month={month}
          slots={sortedSlots}
          assign={assign}
          slotDisplayNum={slotDisplayNum}
          workerMap={workerMap}
          blockMap={blockMap}
          workerRutMap={workerRutMap}
          attendanceByRut={attendanceByRut}
        />
      )}

      {/* Modal asignar vendedor */}
      {dialogSlot !== null && (
        <AssignDialog
          slotNumber={dialogSlot}
          currentWorkerId={assign[String(dialogSlot)] ?? null}
          workers={workers}
          occupied={occupiedByOther(dialogSlot)}
          onClose={() => setDialogSlot(null)}
          onAssign={(wid) => handleAssign(dialogSlot, wid)}
        />
      )}

      {/* Modal semana rotativa */}
      {semanaPicker !== null && patternRotation && patternRotation.length > 1 && (() => {
        const { slotNum, weekIndex: pickerWeek } = semanaPicker;
        const slot = localSlots.find(s => s.slotNumber === slotNum);
        const weekDates = (weeks[pickerWeek] ?? []).map(fmt);
        const offset = slot ? detectSemanaForWeek(slot, patternRotation, weekDates) : 0;
        const workerId = assign[String(slotNum)] ?? null;
        const name = workerId ? (workerMap[workerId] ?? null) : null;
        return (
          <SemanaPicker
            workerName={name}
            currentOffset={offset}
            patternRotation={patternRotation}
            weekIndex={pickerWeek}
            onConfirm={(newOffset, scope) => handleSemanaChange(slotNum, newOffset, scope, pickerWeek)}
            onClose={() => setSemanaPicker(null)}
          />
        );
      })()}

      {/* Modal editar turno */}
      {shiftEditDialog && (
        <ShiftEditDialog
          slotNumber={shiftEditDialog.slotNum}
          dateStr={shiftEditDialog.dateStr}
          workerName={workerMap[assign[String(shiftEditDialog.slotNum)] ?? ""] ?? undefined}
          currentShift={shiftForEdit}
          originalShift={originalShiftForEdit ?? undefined}
          redistributeDays={redistributeDays}
          operatingWindow={operatingWindow}
          onSave={(newShift, redistributeDate, scope) =>
            handleShiftSave(shiftEditDialog.slotNum, shiftEditDialog.dateStr, newShift, redistributeDate, scope)
          }
          onClose={() => setShiftEditDialog(null)}
          onSetLibre={shiftForEdit ? (scope) => handleSetShiftLibre(shiftEditDialog.slotNum, shiftEditDialog.dateStr, scope) : undefined}
        />
      )}

      {/* Modal intercambio de trabajadores */}
      {workerSwapModal && (() => {
        const nameA = workerMap[assign[String(workerSwapModal.slotA)] ?? ""] ?? `Puesto ${workerSwapModal.slotA}`;
        const nameB = workerMap[assign[String(workerSwapModal.slotB)] ?? ""] ?? `Puesto ${workerSwapModal.slotB}`;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setWorkerSwapModal(null)}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Intercambiar turnos</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  ¿Desea intercambiar a <span className="font-semibold text-gray-900">{nameA}</span> por{" "}
                  <span className="font-semibold text-gray-900">{nameB}</span>?
                </p>
              </div>
              <div className="flex flex-col gap-2 border-t border-gray-100 px-6 py-4">
                <button
                  onClick={() => handleWorkerSwap(workerSwapModal.slotA, workerSwapModal.slotB, workerSwapModal.weekDates, "week")}
                  className="w-full px-4 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                  Solo esta semana
                </button>
                <button
                  onClick={() => handleWorkerSwap(workerSwapModal.slotA, workerSwapModal.slotB, workerSwapModal.weekDates, "month")}
                  className="w-full px-4 py-2.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
                >
                  Todo el mes
                </button>
                <button
                  onClick={() => setWorkerSwapModal(null)}
                  className="w-full px-4 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Botón guardar flotante */}
      {dirty && (
        <div className="fixed bottom-6 right-6 z-40">
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex items-center gap-2.5 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-[0_4px_20px_rgba(37,99,235,0.4)] hover:shadow-[0_6px_24px_rgba(37,99,235,0.55)] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      )}

      {/* Modal de confirmación personalizado */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={confirmModal.onNo}>
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5">
              <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">{confirmModal.message}</p>
            </div>
            <div className={`flex border-t border-gray-100 ${confirmModal.noLabel ? "justify-between" : "justify-end"} px-6 py-4 gap-3`}>
              {confirmModal.noLabel && (
                <button
                  onClick={confirmModal.onNo}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {confirmModal.noLabel}
                </button>
              )}
              <button
                onClick={confirmModal.onYes}
                className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
              >
                {confirmModal.yesLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
