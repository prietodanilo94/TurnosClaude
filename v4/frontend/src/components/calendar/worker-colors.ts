// 8 colores con hues bien separados (sin pares visualmente similares).
// Para equipos ≤8 vendedores no se repite ninguno.
const PALETTE = [
  { bg: "bg-blue-200",    text: "text-blue-900",    border: "border-blue-400"    }, // azul
  { bg: "bg-emerald-200", text: "text-emerald-900",  border: "border-emerald-400" }, // verde
  { bg: "bg-orange-200",  text: "text-orange-900",   border: "border-orange-400"  }, // naranja
  { bg: "bg-violet-200",  text: "text-violet-900",   border: "border-violet-400"  }, // violeta
  { bg: "bg-rose-200",    text: "text-rose-900",     border: "border-rose-400"    }, // rojo rosa
  { bg: "bg-amber-200",   text: "text-amber-900",    border: "border-amber-400"   }, // amarillo
  { bg: "bg-cyan-200",    text: "text-cyan-900",     border: "border-cyan-400"    }, // cian
  { bg: "bg-pink-200",    text: "text-pink-900",     border: "border-pink-400"    }, // rosa
] as const;

export interface SlotColor {
  bg: string;
  text: string;
  border: string;
}

export function workerColor(slot: number): SlotColor {
  return PALETTE[(slot - 1) % PALETTE.length];
}

export const UNASSIGNED_COLOR: SlotColor = {
  bg: "bg-gray-100",
  text: "text-gray-400",
  border: "border-gray-200",
};
