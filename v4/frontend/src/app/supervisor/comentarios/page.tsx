"use client";

import { useState, useEffect } from "react";

interface Comment {
  id: string;
  texto: string;
  adminRespuesta: string | null;
  createdAt: string;
}

export default function SupervisorComentariosPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/comments")
      .then((r) => r.json())
      .then((data) => { setComments(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Error al enviar");
      }
      const newComment: Comment = await res.json();
      setComments((prev) => [newComment, ...prev]);
      setTexto("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este comentario?")) return;
    setDeleting(id);
    await fetch(`/api/comments/${id}`, { method: "DELETE" });
    setComments((prev) => prev.filter((c) => c.id !== id));
    setDeleting(null);
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Comentarios y sugerencias</h1>
        <p className="text-sm text-gray-500 mt-1">
          Reporta errores o propone mejoras. El equipo de soporte te responderá aquí.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
        <label className="block text-sm font-medium text-gray-700 mb-2">Nuevo comentario</label>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Describe el problema o mejora que quieres reportar…"
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={submitting || !texto.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Enviando…" : "Enviar comentario"}
          </button>
        </div>
      </form>

      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
          Mis comentarios {comments.length > 0 && `(${comments.length})`}
        </p>

        {loading && (
          <p className="text-sm text-gray-400 text-center py-8">Cargando…</p>
        )}

        {!loading && comments.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No has enviado comentarios aún.</p>
        )}

        {comments.map((c) => (
          <div key={c.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-gray-800 whitespace-pre-wrap flex-1">{c.texto}</p>
                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={deleting === c.id}
                  className="text-xs text-red-500 hover:text-red-700 shrink-0 disabled:opacity-40 transition-colors"
                >
                  {deleting === c.id ? "Eliminando…" : "Eliminar"}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {new Date(c.createdAt).toLocaleDateString("es-CL", {
                  day: "numeric", month: "long", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </div>
            {c.adminRespuesta ? (
              <div className="px-4 py-3 bg-blue-50 border-t border-blue-100">
                <p className="text-xs font-semibold text-blue-700 mb-1">Respuesta del equipo</p>
                <p className="text-sm text-blue-900 whitespace-pre-wrap">{c.adminRespuesta}</p>
              </div>
            ) : (
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                <p className="text-xs text-gray-400 italic">Pendiente de revisión</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
