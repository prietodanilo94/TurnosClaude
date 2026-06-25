"use client";

const MONTHS = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

interface Props {
  year: number;
  month: number;
  onNavigate: (year: number, month: number) => void;
  className?: string;
}

/**
 * Navegador de mes/año reutilizable.
 * No conoce la URL destino — delegado a onNavigate.
 *
 * Uso en supervisor: `onNavigate` actualiza query params vía router.push.
 * Uso en admin:     `onNavigate` genera la URL de ruta dinámica ([year]/[month]).
 */
export default function MonthNavigator({ year, month, onNavigate, className = "" }: Props) {
  function prev() {
    if (month === 1) onNavigate(year - 1, 12);
    else onNavigate(year, month - 1);
  }

  function next() {
    if (month === 12) onNavigate(year + 1, 1);
    else onNavigate(year, month + 1);
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={prev}
        className="px-2 py-1 text-gray-500 hover:text-gray-800 text-sm"
        aria-label="Mes anterior"
      >
        ‹
      </button>
      <span className="text-sm font-medium text-gray-700 min-w-[120px] text-center">
        {MONTHS[month - 1]} {year}
      </span>
      <button
        onClick={next}
        className="px-2 py-1 text-gray-500 hover:text-gray-800 text-sm"
        aria-label="Mes siguiente"
      >
        ›
      </button>
    </div>
  );
}
