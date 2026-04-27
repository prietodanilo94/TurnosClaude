"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const currentUser = useCurrentUser();
  const { user, loading } = currentUser;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Cargando...</p>
      </div>
    );
  }

  return (
    <JefeUserContext.Provider value={currentUser}>
      <div className="min-h-screen flex">
        <aside className="w-56 bg-blue-800 text-white flex flex-col shrink-0">
          <div className="px-4 py-5 border-b border-gray-700">
            <p className="text-sm font-semibold text-white">Shift Optimizer v2</p>
            <p className="text-xs text-gray-400 mt-0.5">Jefe Sucursal</p>
          </div>

          <nav className="flex-1 px-2 py-4 space-y-1">
            <NavLink href="/jefe">Mis Sucursales</NavLink>
          </nav>

          <div className="px-4 py-4 border-t border-blue-700">
            <p className="text-xs text-blue-300 truncate" title={user?.email}>
              {user?.nombre_completo ?? "Modo publico"}
            </p>
            <p className="text-xs text-blue-400 truncate">{user?.email ?? "publico"}</p>
          </div>
        </aside>

        <main className="flex-1 bg-gray-50 min-h-screen overflow-auto">
          {children}
        </main>
      </div>
    </JefeUserContext.Provider>
  );
}
