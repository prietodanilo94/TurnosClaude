"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={`block px-3 py-2 rounded-md text-sm transition-colors ${
        active ? "bg-gray-700 text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}

interface Props {
  userEmail: string;
  children: React.ReactNode;
}

export default function AdminShell({ userEmail, children }: Props) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-48 bg-gray-900 text-white flex flex-col shrink-0">
        <div className="px-4 py-5 border-b border-gray-700">
          <p className="text-sm font-semibold text-white">Shift Planner</p>
          <p className="text-xs text-gray-400 mt-0.5">Administrador</p>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1">
          <NavLink href="/admin">Dashboard</NavLink>
          <NavLink href="/admin/dotacion">Dotación</NavLink>
          <NavLink href="/admin/sucursales">Sucursales</NavLink>
          <NavLink href="/admin/supervisores">Supervisores</NavLink>
          <NavLink href="/admin/historial">Historial</NavLink>
        </nav>

        <div className="px-4 py-4 border-t border-gray-700 space-y-1">
          <p className="text-xs text-gray-500 truncate" title={userEmail}>{userEmail}</p>
          <button
            onClick={handleLogout}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 bg-gray-50 min-h-screen overflow-auto">{children}</main>
    </div>
  );
}
