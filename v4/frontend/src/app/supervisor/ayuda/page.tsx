const STEPS = [
  {
    title: "1. Elige sucursal o grupo",
    text: "En Mis sucursales veras solo lo asignado a tu usuario. Si algo no aparece, pide al administrador revisar permisos.",
  },
  {
    title: "2. Genera o revisa el calendario",
    text: "Usa Generar cuando aun no exista calendario. Usa Regenerar solo si quieres rehacer la plantilla del mes.",
  },
  {
    title: "3. Ajusta vendedores y horarios",
    text: "Haz click en el nombre del vendedor para asignar o cambiar. Haz click en un turno para ajustar horario.",
  },
  {
    title: "4. Revisa cobertura del dia",
    text: "La pestana Cobertura del Dia muestra el Gantt para detectar espacios sin cobertura o turnos solapados.",
  },
  {
    title: "5. Guarda con criterio",
    text: "Si faltan vendedores, puedes guardar una version incompleta como respaldo. La app te lo preguntara antes.",
  },
];

export default function SupervisorHelpPage() {
  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Como usar el calendario</h1>
        <p className="text-sm text-gray-500 mt-1">
          Guia corta para jefes y supervisores. La idea es que puedas operar el mes sin depender de soporte tecnico.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {STEPS.map((step) => (
          <div key={step.title} className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-900">{step.title}</h2>
            <p className="text-sm text-gray-600 mt-2 leading-6">{step.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-amber-900">Como pedir ayuda</h2>
        <p className="text-sm text-amber-800 mt-2 leading-6">
          Envia sucursal o grupo, mes, accion que estabas haciendo y una captura. Con eso podemos revisar historial y logs mucho mas rapido.
        </p>
        <p className="text-sm text-amber-800 mt-2">
          Contacto:{" "}
          <a href="mailto:danilo.prieto@pompeyo.cl" className="font-medium underline hover:text-amber-900">
            danilo.prieto@pompeyo.cl
          </a>
        </p>
      </div>

      <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-900">Errores comunes</h2>
        <ul className="mt-2 space-y-2 text-sm text-gray-600">
          <li><span className="font-medium text-gray-800">Falta categoria:</span> el administrador debe configurar la categoria del equipo.</li>
          <li><span className="font-medium text-gray-800">Faltan vendedores:</span> asigna los espacios pendientes o guarda una version incompleta temporal.</li>
          <li><span className="font-medium text-gray-800">No veo una sucursal:</span> revisa con el administrador que este asignada a tu usuario.</li>
          <li><span className="font-medium text-gray-800">Regenerar:</span> rehace la plantilla del mes. Usalo con cuidado si ya habias editado turnos.</li>
        </ul>
      </div>
    </div>
  );
}
