import type { EstadoProposal, Rol } from "@/types/models";

export type ActionProposal = "publicar" | "seleccionar" | "exportar" | "descartar";

// Tabla de transiciones: "estado:accion" → roles autorizados
// Fuente de verdad: plan.md (spec 010)
const TRANSITIONS: Record<string, Rol[]> = {
  "generada:publicar":      ["admin"],
  "generada:descartar":     ["admin"],
  "publicada:seleccionar":  ["admin", "jefe_sucursal"],
  "publicada:descartar":    ["admin"],
  "seleccionada:exportar":  ["admin", "jefe_sucursal"],
  "seleccionada:descartar": ["admin"],
};

export function canTransition(
  currentState: EstadoProposal,
  action: ActionProposal,
  userRole: Rol
): boolean {
  return TRANSITIONS[`${currentState}:${action}`]?.includes(userRole) ?? false;
}

export function allowedActions(currentState: EstadoProposal, userRole: Rol): ActionProposal[] {
  return (Object.keys(TRANSITIONS) as `${EstadoProposal}:${ActionProposal}`[])
    .filter((key) => key.startsWith(`${currentState}:`) && TRANSITIONS[key].includes(userRole))
    .map((key) => key.split(":")[1] as ActionProposal);
}
