"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/supervisor" && pathname.startsWith(href));
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

export default function SupervisorShell({
  userName,
  children,
}: {
  userName: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-52 bg-gray-900 text-white flex flex-col shrink-0 sticky top-0 h-screen overflow-y-auto">
        <div className="px-4 py-5 border-b border-gray-700 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tp-isotipo.png" alt="TeamPlanner" className="h-14 w-auto mx-auto mb-2" />
          <p className="text-xs font-semibold text-white">TeamPlanner</p>
          <p className="text-xs text-gray-400">Supervisor</p>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1">
          <NavLink href="/supervisor">Mis sucursales</NavLink>
          <NavLink href="/supervisor/ayuda">Cómo usar</NavLink>
          <NavLink href="/supervisor/comentarios">Deja tu comentario</NavLink>
        </nav>

        <div className="px-4 py-4 border-t border-gray-700 space-y-1">
          <p className="text-xs text-gray-500 truncate" title={userName}>{userName}</p>
          <button
            onClick={handleLogout}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Cerrar sesion
          </button>
        </div>
      </aside>

      <main className="flex-1 bg-gray-50 min-h-screen overflow-auto">{children}</main>
    </div>
  );
}
