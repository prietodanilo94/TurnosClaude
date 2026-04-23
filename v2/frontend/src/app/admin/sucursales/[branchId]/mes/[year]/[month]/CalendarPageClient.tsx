"use client";

import { useCallback, useEffect, useState } from "react";
import { Query } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { useCalendarStore } from "@/store/calendar-store";
import { buildOptimizePayload } from "@/lib/optimizer/build-payload";
import { fetchProposals } from "@/lib/proposals/fetch-proposals";
import { persistProposals } from "@/lib/proposals/persist-proposals";
import { CalendarView } from "@/components/calendar/CalendarView";
import type { Worker } from "@/types/models";
import type { OptimizerResponse, ShiftDef } from "@/types/optimizer";

const OPTIMIZER_URL = process.env.NEXT_PUBLIC_OPTIMIZER_URL ?? "http://localhost:8000";
const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main-v2";

type PageState = "loading" | "empty" | "ready" | "generating" | "error";

interface Props {
  branchId: string;
  year: number;
  month: number;
}

export function CalendarPageClient({ branchId, year, month }: Props) {
  const { user, loading: userLoading } = useCurrentUser();
  const init = useCalendarStore((s) => s.init);

  const [pageState, setPageState] = useState<PageState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setPageState("loading");
    setErrorMsg(null);

    try {
      const [payload, rawWorkers, proposals] = await Promise.all([
        buildOptimizePayload(branchId, year, month),
        databases.listDocuments(DB, "workers", [
          Query.equal("branch_id", branchId),
          Query.equal("activo", true),
          Query.limit(200),
        ]),
        fetchProposals(branchId, year, month),
      ]);

      const workerList = rawWorkers.documents as unknown as Worker[];
      const shifts = payload.shift_catalog as ShiftDef[];

      if (proposals.length === 0) {
        setPageState("empty");
        return;
      }

      init({
        branchId,
        year,
        month,
        proposals,
        workers: workerList,
        shiftCatalog: shifts,
        holidays: payload.holidays,
        franjaPorDia: payload.franja_por_dia,
      });
      setPageState("ready");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error inesperado al cargar datos.");
      setPageState("error");
    }
  }, [branchId, year, month, init]);

  useEffect(() => {
    if (!userLoading && user) {
      void loadData();
    }
  }, [userLoading, user, loadData]);

  async function handleGenerate() {
    if (!user) return;
    setPageState("generating");
    setErrorMsg(null);

    try {
      const [payload, rawWorkers] = await Promise.all([
        buildOptimizePayload(branchId, year, month),
        databases.listDocuments(DB, "workers", [
          Query.equal("branch_id", branchId),
          Query.equal("activo", true),
          Query.limit(200),
        ]),
      ]);

      const res = await fetch(`${OPTIMIZER_URL}/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Optimizer respondio ${res.status}: ${text}`);
      }

      const data: OptimizerResponse = await res.json();
      if (!data.propuestas || data.propuestas.length === 0) {
        throw new Error(
          data.diagnostico?.mensajes?.join(" ") ?? "El optimizador no genero propuestas."
        );
      }

      await persistProposals(
        data.propuestas,
        branchId,
        year,
        month,
        user.$id,
        rawWorkers.documents as unknown as Worker[]
      );
      await loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error al generar turnos.");
      setPageState("error");
    }
  }

  if (pageState === "loading" || pageState === "generating") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-500">
        <div className="h-6 w-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        <span className="text-sm">
          {pageState === "generating" ? "Generando turnos..." : "Cargando calendario..."}
        </span>
      </div>
    );
  }

  if (pageState === "error") {
    return (
      <div className="p-6 text-red-600">
        <p className="font-medium">Error</p>
        <p className="text-sm mt-1">{errorMsg}</p>
        <button
          onClick={() => void loadData()}
          className="mt-3 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (pageState === "empty") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-gray-500 text-sm">No hay propuestas generadas para este mes.</p>
        <button
          onClick={() => void handleGenerate()}
          className="px-5 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
        >
          Generar turnos
        </button>
        {errorMsg && <p className="text-xs text-red-600">{errorMsg}</p>}
      </div>
    );
  }

  return <CalendarView />;
}
