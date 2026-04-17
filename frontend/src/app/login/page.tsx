"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppwriteException } from "appwrite";
import { account } from "@/lib/auth/appwrite-client";
import { setRoleCookie } from "@/lib/auth/session";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await account.createEmailPasswordSession(email, password);

      // Usamos labels del usuario Auth para determinar el rol (evita un round-trip a la DB)
      const authUser = await account.get();
      const labels = authUser.labels ?? [];

      if (labels.includes("admin")) {
        setRoleCookie("admin");
        router.push("/admin");
      } else if (labels.includes("jefesucursal")) {
        setRoleCookie("jefesucursal");
        router.push("/jefe");
      } else {
        // Usuario sin rol asignado — logout preventivo
        await account.deleteSession("current");
        setError("Tu cuenta no tiene un rol asignado. Contactá al administrador.");
        setLoading(false);
      }
    } catch (e) {
      if (e instanceof AppwriteException) {
        if (e.code === 401) {
          setError("Email o contraseña incorrectos.");
        } else {
          setError(e.message);
        }
      } else {
        setError("Error inesperado. Intentá de nuevo.");
      }
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Shift Optimizer</h1>
        <p className="text-sm text-gray-500 mb-6">Iniciá sesión para continuar</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="tu@email.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? "Iniciando sesión…" : "Iniciar sesión"}
          </button>
        </form>
      </div>
    </main>
  );
}
