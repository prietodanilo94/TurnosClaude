"use client";

import { useState } from "react";
import { Query } from "appwrite";
import { useCalendarStore } from "@/store/calendar-store";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { databases } from "@/lib/auth/appwrite-client";
import { ID } from "appwrite";

type SaveState = "idle" | "validating" | "saving" | "success" | "error";

const OPTIMIZER_URL = process.env.NEXT_PUBLIC_OPTIMIZER_URL ?? "http://localhost:8000";
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main";
const PROPOSALS_COLLECTION = "proposals";
const ASSIGNMENTS_COLLECTION = "assignments";

export function SaveButton() {
  const {
    dirty, violations, assignments, workers, shiftCatalog,
    holidays, franjaPorDia, activeProposalId, availableProposals, branchId, year, month,
    setViolations, markSaved,
  } = useCalendarStore();

  const { user } = useCurrentUser();
  const [state, setState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const disabled = !dirty || state === "validating" || state === "saving";

  async function handleSave() {
    setState("validating");
    setErrorMsg(null);

    // ── 1. Construir payload para POST /validate ──────────────────────────────
    const payload = {
      branch: {
        id: branchId,
        codigo_area: branchId,
        nombre: "Sucursal",
        tipo_franja: "autopark",
      },
      month: { year, month },
      workers: workers.map((w) => ({
        rut: w.rut,
        nombre: w.nombre_completo,
        constraints: [],
      })),
      holidays,
      shift_catalog: shiftCatalog,
      franja_por_dia: franjaPorDia,
      parametros: {},
      asignaciones: assignments.map((a) => ({
        worker_slot: a.worker_slot,
        worker_rut: a.worker_rut,
        date: a.date,
        shift_id: a.shift_id,
      })),
    };

    // ── 2. Llamar a POST /validate ─────────────────────────────────────────────
    try {
      const res = await fetch(`${OPTIMIZER_URL}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Backend respondió ${res.status}: ${text}`);
      }

      const data = await res.json();
      if (!data.valido && data.violaciones?.length > 0) {
        setViolations(
          data.violaciones.map((v: { tipo: string; worker_rut?: string; detalle: string }) => ({
            tipo: v.tipo,
            worker_rut: v.worker_rut,
            detalle: v.detalle,
          }))
        );
        setState("error");
        setErrorMsg(`${data.violaciones.length} violación(es) detectada(s) por el backend.`);
        return;
      }
    } catch (err) {
      // Si el backend no está disponible, usamos la validación local ya ejecutada.
      if (violations.length > 0) {
        setState("error");
        setErrorMsg("Backend no disponible. Hay violaciones locales pendientes.");
        return;
      }
      // Sin violaciones locales: avisamos pero continuamos.
      console.warn("Backend /validate no disponible, continuando con validación local:", err);
    }

    // ── 3. Persistir en Appwrite ───────────────────────────────────────────────
    setState("saving");
    try {
      if (!activeProposalId) throw new Error("No hay propuesta activa para guardar.");

      const rutToId = new Map(workers.map((w) => [w.rut, w.$id]));

      // 3a. Actualizar asignaciones en la propuesta existente (incluye worker_rut).
      await databases.updateDocument(DATABASE_ID, PROPOSALS_COLLECTION, activeProposalId, {
        asignaciones: JSON.stringify(
          assignments.map((a) => ({
            slot: a.worker_slot,
            date: a.date,
            shift_id: a.shift_id,
            worker_rut: a.worker_rut,
          }))
        ),
        creada_por: user?.$id ?? "",
      });

      // 3b. Un assignment por slot único (índice único proposal_id+slot_numero).
      const slotMap = new Map<number, string>(); // slot → rut
      for (const a of assignments) {
        if (!slotMap.has(a.worker_slot)) slotMap.set(a.worker_slot, a.worker_rut);
      }

      const existing = await databases.listDocuments(DATABASE_ID, ASSIGNMENTS_COLLECTION, [
        Query.equal("proposal_id", activeProposalId),
        Query.limit(200),
      ]);
      const slotToDocId = new Map(
        existing.documents.map((d) => [d.slot_numero as number, d.$id])
      );

      await Promise.all(
        Array.from(slotMap.entries()).map(([slot, rut]) => {
          const workerId = rutToId.get(rut) ?? rut;
          const docId = slotToDocId.get(slot);
          if (docId) {
            return databases.updateDocument(DATABASE_ID, ASSIGNMENTS_COLLECTION, docId, {
              worker_id: workerId,
              asignado_en: new Date().toISOString(),
            });
          }
          return databases.createDocument(DATABASE_ID, ASSIGNMENTS_COLLECTION, ID.unique(), {
            proposal_id: activeProposalId,
            slot_numero: slot,
            worker_id: workerId,
            asignado_en: new Date().toISOString(),
          });
        })
      );
    } catch (err) {
      console.error("Appwrite save fallido:", err);
      setState("error");
      setErrorMsg("Error al guardar en Appwrite.");
      return;
    }

    markSaved();
    setState("success");
    setTimeout(() => setState("idle"), 2500);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSave}
        disabled={disabled}
        className={[
          "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
          state === "success"
            ? "bg-green-600 text-white"
            : state === "error"
            ? "bg-red-100 border border-red-300 text-red-700"
            : disabled
            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
            : "bg-blue-600 text-white hover:bg-blue-700",
        ].join(" ")}
      >
        {state === "validating" && "Validando…"}
        {state === "saving" && "Guardando…"}
        {state === "success" && "¡Guardado!"}
        {state === "error" && "Error"}
        {(state === "idle") && (dirty ? "Guardar" : "Guardado")}
      </button>

      {state === "error" && errorMsg && (
        <span className="text-xs text-red-600">{errorMsg}</span>
      )}
    </div>
  );
}
