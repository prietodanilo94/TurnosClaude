import type { Role } from "./roles";

/**
 * Política de autorización para todos los endpoints /api/.
 *
 * Formato: "METHOD /api/path" → nivel requerido
 *   - "public"        → sin autenticación (login, logout)
 *   - "authenticated" → cualquier sesión válida
 *   - "supervisor"    → supervisor o admin
 *   - "admin"         → solo admin
 *   - "api-key"       → la ruta maneja su propia autenticación (no verificar aquí)
 *
 * Patrones de ruta: usar [param] para segmentos dinámicos.
 * Ejemplo: "GET /api/grupos/[id]" → coincide con /api/grupos/cualquier-cosa
 *
 * ⚠️  DENY BY DEFAULT: cualquier ruta NO presente en este mapa retorna 403.
 *     Al agregar una nueva route.ts, SIEMPRE agregar su entrada aquí.
 */
export type PolicyLevel = "public" | "authenticated" | "supervisor" | "admin" | "api-key";

export const ROUTE_POLICY: Record<string, PolicyLevel> = {
  // ── Auth (público) ──────────────────────────────────────────────────────────
  "POST /api/auth/login":   "public",
  "POST /api/auth/logout":  "public",

  // ── Attendance (API key externa — la ruta verifica su propia clave) ─────────
  "GET  /api/attendance":   "api-key",
  "POST /api/attendance":   "api-key",

  // ── Admin — branches, patterns, comments, utilities ─────────────────────────
  "POST   /api/admin/branches":             "admin",
  "GET    /api/admin/patterns":             "admin",
  "POST   /api/admin/patterns":             "admin",
  "PUT    /api/admin/patterns/[id]":        "admin",
  "DELETE /api/admin/patterns/[id]":        "admin",
  "GET    /api/admin/comments":             "admin",
  "PATCH  /api/admin/comments/[id]":        "admin",
  "DELETE /api/admin/comments/[id]":        "admin",
  "POST   /api/admin/normalize-branches":   "admin",
  "POST   /api/admin/attendance/seed":      "admin",

  // ── Dotación (importación Excel — operación destructiva, solo admin) ────────
  "POST /api/dotacion/sync":    "admin",
  "POST /api/dotacion/preview": "admin",

  // ── Calendarios (supervisor o admin) ────────────────────────────────────────
  "POST   /api/calendars":                    "supervisor",
  "PUT    /api/calendars":                    "supervisor",
  "DELETE /api/calendars":                    "supervisor",
  "GET    /api/calendars/export":             "supervisor",
  "GET    /api/calendars/export-delta":       "supervisor",
  "GET    /api/calendars/export-group":       "supervisor",
  "GET    /api/calendars/export-masivo":      "admin",
  "POST   /api/calendars/save-notify":        "supervisor",
  "POST   /api/calendars/validation-attempt": "supervisor",

  // ── Exportación global ───────────────────────────────────────────────────────
  "GET /api/export/global": "admin",

  // ── Grupos de sucursales ─────────────────────────────────────────────────────
  "GET    /api/grupos":       "supervisor",
  "POST   /api/grupos":       "supervisor",
  "PATCH  /api/grupos/[id]":  "admin",
  "DELETE /api/grupos/[id]":  "supervisor",

  // ── Historial / Audit log ────────────────────────────────────────────────────
  "PATCH /api/historial/[id]": "admin",
  "GET   /api/historial/[id]": "admin",
  "GET   /api/historial/export": "admin",

  // ── Comentarios de supervisor ────────────────────────────────────────────────
  "GET    /api/comments":       "supervisor",
  "POST   /api/comments":       "supervisor",
  "DELETE /api/comments/[id]":  "supervisor",

  // ── Patrones de turno (supervisor) ──────────────────────────────────────────
  "GET    /api/supervisor/patterns":       "supervisor",
  "POST   /api/supervisor/patterns":       "supervisor",
  "DELETE /api/supervisor/patterns/[id]":  "supervisor",

  // ── Teams / categorías ───────────────────────────────────────────────────────
  "PATCH /api/teams/[id]/categoria": "supervisor",

  // ── Bloqueos de vendedores ───────────────────────────────────────────────────
  "GET    /api/blocks": "admin",
  "POST   /api/blocks": "admin",
  "DELETE /api/blocks": "admin",

  // ── Supervisores ─────────────────────────────────────────────────────────────
  "GET    /api/supervisores":       "admin",
  "POST   /api/supervisores":       "admin",
  "PATCH  /api/supervisores/[id]":  "admin",
  "DELETE /api/supervisores/[id]":  "admin",

  // ── Usuarios (acceso web) ────────────────────────────────────────────────────
  "GET    /api/usuarios":       "admin",
  "POST   /api/usuarios":       "admin",
  "PATCH  /api/usuarios/[id]":  "admin",
  "DELETE /api/usuarios/[id]":  "admin",

  // ── Workers ──────────────────────────────────────────────────────────────────
  "GET    /api/workers":        "admin",
  "POST   /api/workers":        "admin",
  "PATCH  /api/workers/[id]":   "admin",
  "DELETE /api/workers/[id]":   "admin",
};

/**
 * Convierte un patrón de ruta con [param] a RegExp.
 * Ejemplo: "/api/grupos/[id]" → /^\/api\/grupos\/[^/]+$/
 */
function patternToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.*+?^${}()|\\]/g, "\\$&")
    .replace(/\\\[([^\]]+)\\]/g, "[^/]+");
  return new RegExp(`^${escaped}$`);
}

const _policyCache = new Map<string, PolicyLevel | undefined>();

/**
 * Devuelve el nivel de autorización requerido para una combinación method+path.
 * Retorna undefined si la ruta no está en el mapa (deny by default).
 *
 * Normaliza los keys del mapa (que pueden tener espacios de alineación)
 * usando split(/\s+/) en lugar de split(" ").
 */
export function getRoutePolicy(method: string, pathname: string): PolicyLevel | undefined {
  const normalizedMethod = method.toUpperCase().trim();
  const cacheKey = `${normalizedMethod} ${pathname}`;

  if (_policyCache.has(cacheKey)) return _policyCache.get(cacheKey);

  for (const [policyKey, level] of Object.entries(ROUTE_POLICY)) {
    const parts = policyKey.trim().split(/\s+/);
    const pMethod = parts[0];
    const pPath = parts[1] ?? "";

    if (pMethod !== normalizedMethod) continue;

    if (pPath === pathname) {
      _policyCache.set(cacheKey, level);
      return level;
    }

    if (pPath.includes("[") && patternToRegex(pPath).test(pathname)) {
      _policyCache.set(cacheKey, level);
      return level;
    }
  }

  _policyCache.set(cacheKey, undefined);
  return undefined;
}

/**
 * Determina si un rol tiene acceso al nivel de política requerido.
 */
export function roleHasAccess(role: Role | undefined, level: PolicyLevel): boolean {
  if (level === "public" || level === "api-key") return true;
  if (!role) return false;
  if (level === "authenticated") return true;
  if (level === "admin") return role === "admin";
  if (level === "supervisor") return role === "admin" || role === "supervisor";
  return false;
}
