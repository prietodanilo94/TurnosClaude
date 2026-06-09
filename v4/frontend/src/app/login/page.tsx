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
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 50%, #EDE9FE 100%)" }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm px-8 py-10 border-t-4" style={{ borderTopColor: "#061DEA" }}>

        {/* Logo + título */}
        <div className="flex flex-col items-center mb-8 gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tp-isotipo.png" alt="TeamPlanner" className="h-14 w-auto mb-3" />
          <span className="text-2xl font-bold tracking-tight" style={{ color: "#061DEA" }}>TeamPlanner</span>
          <span className="text-sm text-gray-400">Ingreso jefes de sucursal</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Email corporativo
            </label>
            <input
              type="text"
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
              required
              autoFocus
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-colors"
              placeholder="nombre@pompeyo.cl"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-colors"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-opacity mt-2"
            style={{ backgroundColor: "#061DEA" }}
            onMouseOver={(e) => !loading && ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#0418c4")}
            onMouseOut={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#061DEA")}
          >
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>

        <div className="mt-5 bg-slate-50 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-400 text-center leading-relaxed">
            Ingresa con tu email corporativo.<br />
            Si es tu primer acceso, define tu contraseña al ingresar.
          </p>
        </div>

        {/* Footer Pompeyo */}
        <div className="flex items-center justify-center gap-2 mt-6 pt-5 border-t border-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tp-isotipo.png" alt="" className="h-4 w-auto opacity-40" />
          <span className="text-xs text-gray-400 font-medium tracking-widest uppercase">Pompeyo Carrasco</span>
        </div>
      </div>
    </div>
  );
}
