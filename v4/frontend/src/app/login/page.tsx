"use client";

import { useState } from "react";

export default function LoginPage() {
  const [credential, setCredential] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: credential, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Credenciales incorrectas");
        return;
      }
      const data = await res.json();
      // Hard navigation to ensure cookie is committed before the request
      window.location.href =
        data.role === "vendedor" ? "/vendedor" : data.role === "supervisor" ? "/supervisor" : "/admin";
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-md w-full max-w-md px-10 py-10">
        <div className="flex flex-col items-center mb-8 gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tp-icon.png" alt="TeamPlanner" className="h-16 w-auto" />
          <span className="text-3xl font-bold" style={{ color: "#061DEA" }}>TeamPlanner</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Email Corporativo
            </label>
            <input
              type="text"
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="nombre@pompeyo.cl"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>

        <p className="text-xs text-gray-400 mt-5 text-center">
          Ingresa con tu email corporativo. Si es tu primer acceso, la contraseña que elijas quedará guardada para los próximos ingresos.
        </p>

        <div className="flex justify-center mt-6 pt-5 border-t border-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-pompeyo.png" alt="Pompeyo Carrasco" className="h-10 w-auto object-contain opacity-70" />
        </div>
      </div>
    </div>
  );
}
