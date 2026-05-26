"use client";

import { useState, useEffect } from "react";

interface Comment {
  id: string;
  texto: string;
  adminRespuesta: string | null;
  createdAt: string;
  supervisor: { nombre: string; email: string | null };
}

function ReplyForm({ comment, onSave }: { comment: Comment; onSave: (id: string, resp: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(comment.adminRespuesta ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/admin/comments/${comment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminRespuesta: text }),
    });
    onSave(comment.id, text);
    setSaving(false);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
      >
        {comment.adminRespuesta ? "Editar respuesta" : "Responder"}
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Escribe la respuesta…"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg disabled:opacity-40 transition-colors"
        >
          {saving ? "Guardando…" : "Guardar respuesta"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function CommentCard({ comment, onSave, onDelete }: { comment: Comment; onSave: (id: string, resp: string) => void; onDelete: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("¿Eliminar este comentario?")) return;
    setDeleting(true);
    await fetch(`/api/admin/comments/${comment.id}`, { method: "DELETE" });
    onDelete(comment.id);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <span className="text-xs font-semibold text-gray-800">{comment.supervisor.nombre}</span>
            {comment.supervisor.email && (
              <span className="text-xs text-gray-400 ml-1.5">{comment.supervisor.email}</span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-gray-400">
              {new Date(comment.createdAt).toLocaleDateString("es-CL", {
                day: "numeric", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
            >
              {deleting ? "Eliminando…" : "Eliminar"}
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{comment.texto}</p>
      </div>
      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
        {comment.adminRespuesta && (
          <div className="mb-2">
            <p className="text-xs font-semibold text-blue-700 mb-0.5">Tu respuesta</p>
            <p className="text-sm text-blue-900 whitespace-pre-wrap mb-2">{comment.adminRespuesta}</p>
          </div>
        )}
        <ReplyForm comment={comment} onSave={onSave} />
      </div>
    </div>
  );
}

export default function AdminComentariosPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/comments")
      .then((r) => r.json())
      .then((data) => { setComments(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function handleSave(id: string, resp: string) {
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, adminRespuesta: resp.trim() || null } : c))
    );
  }

  function handleDelete(id: string) {
    setComments((prev) => prev.filter((c) => c.id !== id));
  }

  const pending = comments.filter((c) => !c.adminRespuesta);
  const replied  = comments.filter((c) => c.adminRespuesta);

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Comentarios de supervisores</h1>
        <p className="text-sm text-gray-500 mt-1">
          {loading
            ? "Cargando…"
            : `${comments.length} comentario${comments.length !== 1 ? "s" : ""} en total · ${pending.length} sin responder`}
        </p>
      </div>

      {loading && <p className="text-sm text-gray-400 text-center py-12">Cargando…</p>}

      {!loading && comments.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-12">No hay comentarios aún.</p>
      )}

      {!loading && pending.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-2">
            Sin responder ({pending.length})
          </p>
          <div className="space-y-3">
            {pending.map((c) => <CommentCard key={c.id} comment={c} onSave={handleSave} onDelete={handleDelete} />)}
          </div>
        </div>
      )}

      {!loading && replied.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-2">
            Respondidos ({replied.length})
          </p>
          <div className="space-y-3">
            {replied.map((c) => <CommentCard key={c.id} comment={c} onSave={handleSave} onDelete={handleDelete} />)}
          </div>
        </div>
      )}
    </div>
  );
}
