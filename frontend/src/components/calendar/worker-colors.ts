// Paleta de 12 colores estables por slot (1-12).
// Más de 12 workers repite desde el principio.

const PALETTE = [
  { bg: "bg-blue-100",   text: "text-blue-800",   border: "border-blue-300"   },
  { bg: "bg-emerald-100",text: "text-emerald-800", border: "border-emerald-300"},
  { bg: "bg-violet-100", text: "text-violet-800",  border: "border-violet-300" },
  { bg: "bg-orange-100", text: "text-orange-800",  border: "border-orange-300" },
  { bg: "bg-rose-100",   text: "text-rose-800",    border: "border-rose-300"   },
  { bg: "bg-teal-100",   text: "text-teal-800",    border: "border-teal-300"   },
  { bg: "bg-pink-100",   text: "text-pink-800",    border: "border-pink-300"   },
  { bg: "bg-amber-100",  text: "text-amber-800",   border: "border-amber-300"  },
  { bg: "bg-indigo-100", text: "text-indigo-800",  border: "border-indigo-300" },
  { bg: "bg-cyan-100",   text: "text-cyan-800",    border: "border-cyan-300"   },
  { bg: "bg-lime-100",   text: "text-lime-800",    border: "border-lime-300"   },
  { bg: "bg-fuchsia-100",text: "text-fuchsia-800", border: "border-fuchsia-300"},
] as const;

export interface SlotColor {
  bg: string;
  text: string;
  border: string;
}

/** Devuelve las clases Tailwind para el slot número `slot` (1-based). */
export function workerColor(slot: number): SlotColor {
  return PALETTE[(slot - 1) % PALETTE.length];
}

/** Clases para un slot sin trabajador asignado todavía. */
export const UNASSIGNED_COLOR: SlotColor = {
  bg: "bg-gray-100",
  text: "text-gray-500",
  border: "border-gray-300",
};
