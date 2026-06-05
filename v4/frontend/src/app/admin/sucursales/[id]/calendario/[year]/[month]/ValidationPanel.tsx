import type { CalendarValidationResult } from "@/lib/calendar/validation";

export function CalendarValidationPanel({ validation }: { validation: CalendarValidationResult }) {
  const preview = validation.issues.slice(0, 5);
  const hiddenCount = Math.max(0, validation.issues.length - preview.length);

  if (validation.issues.length === 0) {
    return (
      <div className="mb-4 border border-green-200 bg-green-50 rounded-lg px-4 py-3">
        <div className="text-sm font-semibold text-green-800">Listo para guardar</div>
        <div className="text-xs text-green-700 mt-0.5">
          No se detectaron problemas bloqueantes ni advertencias en este calendario.
        </div>
      </div>
    );
  }

  return (
    <div className={`mb-4 border rounded-lg px-4 py-3 ${
      validation.errors.length > 0
        ? "border-rose-200 bg-rose-50"
        : "border-amber-200 bg-amber-50"
    }`}>
      <div className={`text-sm font-semibold ${validation.errors.length > 0 ? "text-rose-800" : "text-amber-800"}`}>
        {validation.errors.length > 0 ? "Requiere correccion antes de guardar" : "Revisar antes de publicar"}
      </div>
      <div className={`text-xs mt-0.5 ${validation.errors.length > 0 ? "text-rose-700" : "text-amber-700"}`}>
        {validation.errors.length} error{validation.errors.length !== 1 ? "es" : ""} y {validation.warnings.length} advertencia{validation.warnings.length !== 1 ? "s" : ""}.
      </div>

      <ul className="mt-3 space-y-1.5">
        {preview.map((issue, index) => (
          <li key={`${issue.code}-${issue.slotNumber ?? "day"}-${issue.dateStr ?? index}`} className="text-xs text-gray-800">
            <span className={`font-semibold ${issue.severity === "error" ? "text-rose-700" : "text-amber-700"}`}>
              {issue.severity === "error" ? "Error" : "Aviso"}:
            </span>{" "}
            <span className="font-medium">{issue.title}.</span>{" "}
            <span className="text-gray-600">{issue.detail}</span>
          </li>
        ))}
      </ul>

      {hiddenCount > 0 && (
        <div className="text-xs text-gray-500 mt-2">
          Hay {hiddenCount} problema{hiddenCount !== 1 ? "s" : ""} adicional{hiddenCount !== 1 ? "es" : ""}. Corrige los primeros y vuelve a revisar.
        </div>
      )}
    </div>
  );
}

export function buildValidationSummary(validation: CalendarValidationResult) {
  return {
    errorCount: validation.errors.length,
    warningCount: validation.warnings.length,
    warningCodes: [...new Set(validation.warnings.map((issue) => issue.code))],
  };
}

export function buildSaveSuccessFeedback(
  validation: CalendarValidationResult,
  scopeLabel: string,
): { tone: "success" | "warning"; text: string } {
  if (validation.errors.length > 0) {
    return {
      tone: "warning",
      text: `${scopeLabel}: calendario guardado como version incompleta. Quedan ${validation.errors.length} problema${validation.errors.length !== 1 ? "s" : ""} por corregir.`,
    };
  }

  if (validation.warnings.length > 0) {
    return {
      tone: "warning",
      text: `${scopeLabel}: calendario guardado con ${validation.warnings.length} advertencia${validation.warnings.length !== 1 ? "s" : ""}.`,
    };
  }

  return { tone: "success", text: `${scopeLabel}: calendario guardado correctamente.` };
}
