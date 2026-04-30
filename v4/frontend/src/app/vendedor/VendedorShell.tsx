"use client";

import { useRouter } from "next/navigation";

interface Props {
  nombre: string;
  children: React.ReactNode;
}

export default function VendedorShell({ nombre, children }: Props) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold text-gray-900">Shift Optimizer</span>
          <span className="ml-3 text-xs text-gray-400">Mis turnos</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-600 font-medium">{nombre}</span>
          <button
            onClick={handleLogout}
            className="text-xs text-red-400 hover:text-red-600 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </header>
      <main className="p-6 max-w-4xl mx-auto">{children}</main>
    </div>
  );
}
