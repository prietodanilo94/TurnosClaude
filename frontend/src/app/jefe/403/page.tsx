import Link from "next/link";

export default function JefeForbiddenPage() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 text-center">
      <p className="text-5xl font-bold text-blue-800">403</p>
      <h1 className="mt-4 text-xl font-semibold text-gray-900">
        Acceso no autorizado
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        No tenés permiso para ver esta sucursal.
      </p>
      <Link
        href="/jefe"
        className="mt-6 inline-block px-4 py-2 bg-blue-700 text-white text-sm rounded-md hover:bg-blue-800 transition-colors"
      >
        Volver a Mis Sucursales
      </Link>
    </div>
  );
}
