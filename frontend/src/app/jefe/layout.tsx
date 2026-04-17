"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { account } from "@/lib/auth/appwrite-client";
import { clearRoleCookie } from "@/lib/auth/session";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { JefeUserContext } from "@/lib/auth/jefe-user-context";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/jefe" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={`block px-3 py-2 rounded-md text-sm transition-colors ${
        active
          ? "bg-blue-700 text-white"
          : "text-blue-100 hover:bg-blue-700 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}

export default function JefeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const currentUser = useCurrentUser();
  const { user, isJefe, loading, error, authorizedBranchIds } = currentUser;

  // Redirigir a login si no es jefe
  useEffect(() => {
    if (!loading && (error || !isJefe)) {
      router.replace("/login");
    }
  }, [loading, error, isJefe, router]);

  // Verificar acceso a sucursal específica en /jefe/sucursales/[branchId]
  useEffect(() => {
    if (loading || !isJefe) return;
    const segments = pathname.split("/").filter(Boolean);
    // Patrón: /jefe/sucursales/[branchId]
    if (segments[0] === "jefe" && segments[1] === "sucursales" && segments[2]) {
      const branchId = segments[2];
      if (!authorizedBranchIds.includes(branchId)) {
        router.replace("/jefe/403");
      }
    }
  }, [loading, isJefe, pathname, authorizedBranchIds, router]);

  async function handleLogout() {
    try {
      await account.deleteSession("current");
    } finally {
      clearRoleCookie();
      router.push("/login");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Cargando…</p>
      </div>
    );
  }

  if (error || !isJefe) return null;

  return (
    <JefeUserContext.Provider value={currentUser}>
      <div className="min-h-screen flex">
        <aside className="w-56 bg-blue-800 text-white flex flex-col shrink-0">
          <div className="px-4 py-5 border-b border-blue-700">
            <p className="text-sm font-semibold text-white">Shift Optimizer</p>
            <p className="text-xs text-blue-300 mt-0.5">Jefe de Sucursal</p>
          </div>

          <nav className="flex-1 px-2 py-4 space-y-1">
            <NavLink href="/jefe">Mis Sucursales</NavLink>
          </nav>

          <div className="px-4 py-4 border-t border-blue-700">
            <p className="text-xs text-blue-300 truncate" title={user?.email}>
              {user?.nombre_completo}
            </p>
            <p className="text-xs text-blue-400 truncate">{user?.email}</p>
            <button
              onClick={handleLogout}
              className="mt-2 text-xs text-red-300 hover:text-red-200 transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
        </aside>

        <main className="flex-1 bg-gray-50 min-h-screen overflow-auto">
          {children}
        </main>
      </div>
    </JefeUserContext.Provider>
  );
}
