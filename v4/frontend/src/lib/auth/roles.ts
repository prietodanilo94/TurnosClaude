/**
 * Definición canónica de roles del sistema.
 * FUENTE ÚNICA DE VERDAD — no hardcodear strings de rol en otro lugar.
 *
 * Para agregar un rol nuevo (ej. "jefe_sucursal" para F6):
 * 1. Agregar aquí en ROLES
 * 2. Actualizar ROUTE_POLICY en route-policy.ts con los permisos del nuevo rol
 * 3. Actualizar el JWT signing en session.ts para incluir el nuevo rol
 */
export const ROLES = {
  admin:      "admin",
  supervisor: "supervisor",
  vendedor:   "vendedor",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: Role[] = Object.values(ROLES);

export function isValidRole(value: string): value is Role {
  return Object.values(ROLES).includes(value as Role);
}
