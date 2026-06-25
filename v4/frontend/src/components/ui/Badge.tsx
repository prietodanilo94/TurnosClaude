interface Props {
  variant?: "gray" | "green" | "yellow" | "red" | "blue" | "purple";
  children: React.ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<NonNullable<Props["variant"]>, string> = {
  gray:   "bg-gray-100 text-gray-700",
  green:  "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700",
  red:    "bg-red-100 text-red-700",
  blue:   "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
};

/**
 * Badge de texto inline — para roles, estados, etiquetas cortas.
 * Sin "use client" — funciona en server y client components.
 */
export default function Badge({ variant = "gray", children, className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
