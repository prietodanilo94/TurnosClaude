// 20 colores con hues bien separados para equipos multi-sucursal.
const PALETTE = [
  { bg: "bg-blue-200",     text: "text-blue-900",     border: "border-blue-400"     }, // azul
  { bg: "bg-emerald-200",  text: "text-emerald-900",  border: "border-emerald-400"  }, // verde
  { bg: "bg-orange-200",   text: "text-orange-900",   border: "border-orange-400"   }, // naranja
  { bg: "bg-violet-200",   text: "text-violet-900",   border: "border-violet-400"   }, // violeta
  { bg: "bg-rose-200",     text: "text-rose-900",     border: "border-rose-400"     }, // rojo rosa
  { bg: "bg-amber-200",    text: "text-amber-900",    border: "border-amber-400"    }, // amarillo
  { bg: "bg-cyan-200",     text: "text-cyan-900",     border: "border-cyan-400"     }, // cian
  { bg: "bg-pink-200",     text: "text-pink-900",     border: "border-pink-400"     }, // rosa
  { bg: "bg-teal-200",     text: "text-teal-900",     border: "border-teal-400"     }, // teal
  { bg: "bg-indigo-200",   text: "text-indigo-900",   border: "border-indigo-400"   }, // índigo
  { bg: "bg-lime-200",     text: "text-lime-900",     border: "border-lime-400"     }, // lima
  { bg: "bg-red-200",      text: "text-red-900",      border: "border-red-400"      }, // rojo
  { bg: "bg-sky-200",      text: "text-sky-900",      border: "border-sky-400"      }, // celeste
  { bg: "bg-fuchsia-200",  text: "text-fuchsia-900",  border: "border-fuchsia-400"  }, // fucsia
  { bg: "bg-yellow-200",   text: "text-yellow-900",   border: "border-yellow-400"   }, // amarillo claro
  { bg: "bg-green-200",    text: "text-green-900",    border: "border-green-400"    }, // verde medio
  { bg: "bg-purple-200",   text: "text-purple-900",   border: "border-purple-400"   }, // púrpura
  { bg: "bg-blue-300",     text: "text-blue-950",     border: "border-blue-500"     }, // azul oscuro
  { bg: "bg-emerald-300",  text: "text-emerald-950",  border: "border-emerald-500"  }, // verde oscuro
  { bg: "bg-orange-300",   text: "text-orange-950",   border: "border-orange-500"   }, // naranja oscuro
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
