"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { account } from "@/lib/auth/appwrite-client";
import { clearRoleCookie } from "@/lib/auth/session";
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
  const router = useRouter();
  const { user, isAdmin, loading, error } = useCurrentUser();

  useEffect(() => {
    if (!loading && (error || !isAdmin)) {
      router.replace("/login");
    }
  }, [loading, error, isAdmin, router]);

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

  if (error || !isAdmin) return null;

  return (
    <div className="min-h-screen flex">
      <aside className="w-44 bg-gray-900 text-white flex flex-col shrink-0">
        <div className="px-4 py-5 border-b border-gray-700">
          <p className="text-sm font-semibold text-white">Shift Optimizer</p>
          <p className="text-xs text-gray-400 mt-0.5">Administrador</p>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1">
          <NavLink href="/admin">Dashboard</NavLink>
          <NavLink href="/admin/sucursales">Sucursales</NavLink>
          <NavLink href="/admin/feriados">Feriados</NavLink>
          <NavLink href="/admin/usuarios">Usuarios</NavLink>
          <NavLink href="/admin/dotacion">Dotación</NavLink>
          <NavLink href="/admin/trabajadores">Trabajadores</NavLink>
        </nav>

        <div className="px-4 py-4 border-t border-gray-700">
          <p className="text-xs text-gray-400 truncate" title={user?.email}>
            {user?.email}
          </p>
          <button
            onClick={handleLogout}
            className="mt-2 text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 bg-gray-50 min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  );
}
