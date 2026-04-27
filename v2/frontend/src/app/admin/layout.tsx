"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/lib/auth/use-current-user";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={`block px-3 py-2 rounded-md text-sm transition-colors ${
        active
          ? "bg-gray-700 text-white"
          : "text-gray-300 hover:bg-gray-700 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useCurrentUser();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-44 bg-gray-900 text-white flex flex-col shrink-0">
        <div className="px-4 py-5 border-b border-gray-700">
          <p className="text-sm font-semibold text-white">Shift Optimizer v2</p>
          <p className="text-xs text-gray-400 mt-0.5">Administrador</p>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1">
          <NavLink href="/admin">Dashboard</NavLink>
          <NavLink href="/admin/sucursales">Sucursales</NavLink>
          <NavLink href="/admin/factibilidad">Factibilidad</NavLink>
          <NavLink href="/admin/feriados">Feriados</NavLink>
          <NavLink href="/admin/usuarios">Usuarios</NavLink>
          <NavLink href="/admin/dotacion">Dotacion</NavLink>
          <NavLink href="/admin/trabajadores">Trabajadores</NavLink>
        </nav>

        <div className="px-4 py-4 border-t border-gray-700">
          <p className="text-xs text-gray-400 truncate" title={user?.email}>
            {user?.email ?? "Modo publico"}
          </p>
        </div>
      </aside>

      <main className="flex-1 bg-gray-50 min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  );
}
