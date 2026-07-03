"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

interface Props {
  anchorRef: RefObject<HTMLElement>;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}

// Renderiza `children` en un portal a document.body, posicionado con
// position:fixed segun las coordenadas reales del elemento ancla. Evita que
// contenedores con overflow-hidden/overflow-x-auto (como la tarjeta de la
// tabla, que se achica cuando hay pocas filas) corten el desplegable de
// filtros por columna.
export default function FloatingPanel({ anchorRef, open, onClose, children, width = 224 }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) { setPos(null); return; }
    const rect = anchorRef.current.getBoundingClientRect();
    let left = rect.left;
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
    setPos({ top: rect.bottom + 4, left });
  }, [open, anchorRef, width]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      onClose();
    }
    function onScroll(e: Event) {
      // Ignorar el scroll interno del propio panel (ej. la lista de valores)
      if (panelRef.current?.contains(e.target as Node)) return;
      onClose();
    }
    function onResize() {
      onClose();
    }

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !pos) return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{ position: "fixed", top: pos.top, left: pos.left, width, zIndex: 50 }}
      className="bg-white border border-gray-200 rounded-md shadow-lg p-2 normal-case font-normal text-gray-700"
    >
      {children}
    </div>,
    document.body,
  );
}
