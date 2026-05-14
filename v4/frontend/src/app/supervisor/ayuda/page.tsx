"use client";

import { useState } from "react";

interface Section {
  id: string;
  icon: string;
  title: string;
  content: React.ReactNode;
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 flex gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
      <span className="text-blue-400 mt-0.5 shrink-0">💡</span>
      <p className="text-xs text-blue-800 leading-5">{children}</p>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 flex gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
      <span className="text-amber-500 mt-0.5 shrink-0">⚠️</span>
      <p className="text-xs text-amber-800 leading-5">{children}</p>
    </div>
  );
}

function List({ items }: { items: { label: string; desc: string }[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item) => (
        <li key={item.label} className="text-sm text-gray-600 leading-6">
          <span className="font-medium text-gray-800">{item.label}:</span>{" "}
          {item.desc}
        </li>
      ))}
    </ul>
  );
}

const SECTIONS: Section[] = [
  {
    id: "inicio",
    icon: "🏠",
    title: "Pantalla de inicio — Mis sucursales",
    content: (
      <div className="space-y-2 text-sm text-gray-600 leading-6">
        <p>
          Al entrar, ves las sucursales asignadas a tu usuario organizadas en tarjetas. Cada tarjeta muestra el
          nombre, área de negocio (Ventas / Postventa) y si ya tiene calendario generado para el mes actual.
        </p>
        <p>
          Si administras varias sucursales puedes seleccionarlas con los{" "}
          <span className="font-medium text-gray-800">checkboxes</span> y hacer click en{" "}
          <span className="font-medium text-gray-800">Asignación de turnos</span> para ver un calendario
          combinado con todos los equipos juntos.
        </p>
        <List
          items={[
            {
              label: "Una sucursal",
              desc: "Haz click directamente en la tarjeta para abrir su calendario.",
            },
            {
              label: "Varias sucursales",
              desc: "Activa los checkboxes y presiona Asignación de turnos. El sistema las une automáticamente en un grupo.",
            },
            {
              label: "Grupo ya existente",
              desc: "Aparece como una tarjeta separada con el icono de grupo. Solo el administrador puede disolverlo.",
            },
          ]}
        />
        <Tip>
          Si no ves una sucursal que debería estar asignada a ti, contacta al administrador para que revise tus
          permisos.
        </Tip>
      </div>
    ),
  },
  {
    id: "navegacion",
    icon: "📅",
    title: "Navegación por mes y año",
    content: (
      <div className="space-y-2 text-sm text-gray-600 leading-6">
        <p>
          Dentro del calendario hay un selector de <span className="font-medium text-gray-800">mes</span> y{" "}
          <span className="font-medium text-gray-800">año</span> en la esquina superior derecha de la barra de
          pestañas. Cambiar el mes navega al calendario de ese período.
        </p>
        <p>
          Si tienes cambios sin guardar, la app te preguntará si deseas guardar antes de salir. Responde{" "}
          <span className="font-medium">Guardar y salir</span> para conservar los cambios o{" "}
          <span className="font-medium">Salir sin guardar</span> para descartar.
        </p>
        <Warning>
          Cerrar la pestaña del navegador con cambios sin guardar activará el aviso del navegador, pero si
          navegas dentro de la app usa siempre los botones de la pantalla para no perder trabajo.
        </Warning>
      </div>
    ),
  },
  {
    id: "mensual",
    icon: "📊",
    title: "Pestaña: Calendario Mensual",
    content: (
      <div className="space-y-2 text-sm text-gray-600 leading-6">
        <p>
          Es la vista principal. Muestra una tabla por semana ISO donde las filas son los slots de turno (cada
          fila corresponde a un vendedor) y las columnas son los días de la semana.
        </p>
        <List
          items={[
            {
              label: "Click en el nombre del vendedor (columna izquierda)",
              desc: "Abre el diálogo de asignación para cambiar qué vendedor está en ese slot.",
            },
            {
              label: "Click en una celda de turno",
              desc: "Abre el editor de horario para ajustar la hora de entrada y salida de ese día.",
            },
            {
              label: "Click en el encabezado de una columna (día)",
              desc: "Muestra el Gantt del día debajo de la fila de encabezado para ver todos los horarios en forma visual.",
            },
            {
              label: "Arrastrar una celda de turno",
              desc: "Mueve el turno a otro día dentro de la misma semana y slot. Útil para intercambiar libre y turno.",
            },
            {
              label: "Columna Hrs Sem",
              desc: "Muestra las horas laborales netas del vendedor en esa semana (ya descontado el colación).",
            },
          ]}
        />
        <p className="mt-2">
          <span className="font-medium text-gray-800">Colores:</span> cada slot tiene un color único. Las celdas
          con nombre visible tienen el color del slot asignado; las celdas azules claras son slots sin vendedor
          asignado aún. Las celdas grises son bloqueos (vacaciones, licencia).
        </p>
        <Tip>
          Los días anteriores a hoy están bloqueados en calendarios ya guardados: no se pueden editar ni arrastrar.
          Esto evita modificar turnos del pasado accidentalmente.
        </Tip>
      </div>
    ),
  },
  {
    id: "vendedor",
    icon: "👤",
    title: "Pestaña: Turno por Vendedor",
    content: (
      <div className="space-y-2 text-sm text-gray-600 leading-6">
        <p>
          Muestra un mini-calendario individual por cada vendedor. Ideal para revisar el mes completo de una
          persona o comparar el turno de dos vendedores en paralelo.
        </p>
        <List
          items={[
            {
              label: "Filtros de vendedores (chips superiores)",
              desc: "Activa o desactiva qué vendedores se muestran. El botón Todos muestra o esconde a todos.",
            },
            {
              label: "Header del vendedor (barra de color)",
              desc: "Haz click para cambiar qué vendedor está asignado a ese slot.",
            },
            {
              label: "Click en celda de turno",
              desc: "Abre el editor de horario exactamente igual que en la vista Mensual.",
            },
            {
              label: "Arrastrar una celda",
              desc: "Mueve el turno a otro día de la misma semana. También funciona el intercambio entre días con turno y días libres.",
            },
            {
              label: "Columna Hrs",
              desc: "Horas netas de esa semana. El total mensual aparece en el header junto al número de slot.",
            },
          ]}
        />
        <Tip>
          Esta pestaña es especialmente útil cuando un vendedor pide un cambio puntual de día: puedes ver su
          semana completa, hacer el intercambio con drag & drop y guardar.
        </Tip>
      </div>
    ),
  },
  {
    id: "cobertura",
    icon: "📈",
    title: "Pestaña: Cobertura del Día",
    content: (
      <div className="space-y-2 text-sm text-gray-600 leading-6">
        <p>
          Muestra un diagrama de Gantt para cada día del mes. Permite detectar huecos de cobertura (horas sin
          nadie atendiendo) y solapamientos que podrían indicar errores en el calendario.
        </p>
        <List
          items={[
            {
              label: "Mini-calendario de filtro",
              desc: "Haz click en los días para mostrar u ocultar. Útil para enfocarse en fines de semana o días específicos.",
            },
            {
              label: "Barras horizontales",
              desc: "Cada barra es el turno de un vendedor. El ancho representa la duración; el color identifica al vendedor.",
            },
            {
              label: "Días rojos",
              desc: "Son feriados irrenunciables (1 enero, 1 mayo, 18-19 septiembre, 25 diciembre). Nadie trabaja esos días.",
            },
          ]}
        />
        <Tip>
          Esta vista no permite editar. Es solo lectura. Para hacer cambios, vuelve a Calendario Mensual o Turno
          por Vendedor.
        </Tip>
      </div>
    ),
  },
  {
    id: "generar",
    icon: "⚙️",
    title: "Generar, Reiniciar y Guardar",
    content: (
      <div className="space-y-2 text-sm text-gray-600 leading-6">
        <List
          items={[
            {
              label: "Generar",
              desc: "Crea la plantilla de turnos del mes por primera vez y asigna a los vendedores automáticamente en orden. Aparece cuando el calendario aún no existe.",
            },
            {
              label: "Reiniciar",
              desc: "Borra todas las asignaciones de vendedores dejando los slots vacíos, pero conserva la estructura de turnos del mes. Úsalo si quieres reasignar desde cero sin cambiar los horarios.",
            },
            {
              label: "Guardar",
              desc: "Confirma todos los cambios y los guarda en la base de datos. RRHH será notificado automáticamente. El botón está activo solo si hay cambios pendientes.",
            },
          ]}
        />
        <Warning>
          Reiniciar es una acción destructiva: borra todas las asignaciones del mes. Te pedirá confirmación
          antes de proceder. No afecta calendarios de otros meses.
        </Warning>
        <Tip>
          Si guardas un calendario con vendedores sin asignar, se guarda como "versión incompleta". Puedes
          completarlo después. La app te avisa antes de guardar si faltan asignaciones.
        </Tip>
      </div>
    ),
  },
  {
    id: "asignar",
    icon: "🔄",
    title: "Asignar vendedores a slots",
    content: (
      <div className="space-y-2 text-sm text-gray-600 leading-6">
        <p>
          Cada fila del calendario es un <span className="font-medium text-gray-800">slot</span> (posición de
          turno). Un slot puede estar vacío o tener asignado un vendedor.
        </p>
        <p>
          Para asignar, haz click en el nombre en la columna izquierda (vista Mensual) o en el header del
          vendedor (vista Turno por Vendedor). Se abrirá un listado con los vendedores disponibles para ese slot.
        </p>
        <List
          items={[
            {
              label: "Vendedor actual",
              desc: "Aparece marcado como 'actual' en el listado. Haz click en él si quieres mantenerlo.",
            },
            {
              label: "Quitar asignación",
              desc: "Botón rojo al pie del diálogo. Deja el slot vacío.",
            },
            {
              label: "Vendedores no disponibles",
              desc: "Los que ya están asignados en otro slot del mismo mes no aparecen en la lista (no se puede duplicar).",
            },
          ]}
        />
        <Tip>
          Si un vendedor no aparece en el listado, puede que ya esté asignado en otro slot. Revisa la columna
          izquierda del calendario para encontrar dónde está asignado actualmente.
        </Tip>
      </div>
    ),
  },
  {
    id: "editar",
    icon: "✏️",
    title: "Editar horarios de turno",
    content: (
      <div className="space-y-2 text-sm text-gray-600 leading-6">
        <p>
          Al hacer click en una celda de turno se abre el editor. Desde ahí puedes ajustar la hora de inicio y
          término del turno para ese día específico.
        </p>
        <List
          items={[
            {
              label: "◀ Atrasar 1h / Adelantar 1h ▶",
              desc: "Mueve el turno completo 60 minutos hacia atrás o adelante, respetando la franja operativa de la sucursal.",
            },
            {
              label: "◀ 30 min / 30 min ▶",
              desc: "Igual que los botones de 1h pero en incrementos de 30 minutos.",
            },
            {
              label: "Inputs manuales (Inicio / Final)",
              desc: "Permite ingresar una hora exacta. La app valida que el turno esté dentro de la franja y no supere 10 horas netas.",
            },
            {
              label: "Redistribuir horas",
              desc: "Si acortas un turno, la app te pregunta si quieres agregar esas horas a otro día de la misma semana para compensar.",
            },
          ]}
        />
        <Warning>
          Cada sucursal tiene una franja operativa (ej. 09:00–19:00). No puedes ingresar horarios fuera de ese
          rango ni turnos que superen 10 horas netas. El botón Guardar se desactiva si el horario no es válido.
        </Warning>
        <Tip>
          El resumen de horas debajo de los inputs muestra en tiempo real cuántas horas laborales tiene el
          turno modificado y si hay diferencia respecto al turno original.
        </Tip>
      </div>
    ),
  },
  {
    id: "dragdrop",
    icon: "↔️",
    title: "Mover turnos con drag & drop",
    content: (
      <div className="space-y-2 text-sm text-gray-600 leading-6">
        <p>
          Puedes arrastrar una celda de turno a otro día dentro de la misma semana y el mismo slot. Esto
          intercambia el contenido de los dos días (uno queda con el turno y el otro con libre, o se intercambian
          dos turnos entre sí).
        </p>
        <List
          items={[
            {
              label: "Arrastrar turno a día libre",
              desc: "El turno se mueve al día libre; el día original queda libre.",
            },
            {
              label: "Arrastrar turno a otro turno",
              desc: "Los dos días intercambian sus turnos.",
            },
            {
              label: "Arrastrar día libre a turno",
              desc: "Equivale a mover el turno al día libre.",
            },
          ]}
        />
        <Warning>
          No se puede mover un turno a un día que la sucursal no opera (ej. domingo si el patrón no incluye
          domingos). Tampoco se permiten cambios que generen más de 6 días laborales consecutivos.
        </Warning>
        <Tip>
          En calendarios ya guardados, los días anteriores a hoy están bloqueados y no se pueden arrastrar.
        </Tip>
      </div>
    ),
  },
  {
    id: "grupos",
    icon: "🏢",
    title: "Grupos de sucursales",
    content: (
      <div className="space-y-2 text-sm text-gray-600 leading-6">
        <p>
          Cuando administras varias sucursales puedes crear un grupo para ver y editar sus calendarios
          combinados en una sola pantalla.
        </p>
        <p>
          En la pantalla de inicio, activa los checkboxes de 2 o más sucursales y haz click en{" "}
          <span className="font-medium text-gray-800">Asignación de turnos</span>. La app crea el grupo
          automáticamente.
        </p>
        <List
          items={[
            {
              label: "Vista combinada por área",
              desc: "Si el grupo tiene sucursales con Ventas y Postventa, aparecen dos bloques separados: uno por área.",
            },
            {
              label: "Guardado automático por equipo",
              desc: "Al guardar un calendario de grupo, la app guarda por separado el calendar de cada equipo. RRHH recibe un solo archivo Excel consolidado.",
            },
            {
              label: "Disolver un grupo",
              desc: "Solo el administrador puede hacerlo desde /admin/grupos.",
            },
          ]}
        />
        <Tip>
          Una sucursal solo puede pertenecer a un grupo a la vez. Si intentas crear un grupo con una sucursal
          que ya está en otro, la app te avisará.
        </Tip>
      </div>
    ),
  },
  {
    id: "exportar",
    icon: "📥",
    title: "Exportar el calendario",
    content: (
      <div className="space-y-2 text-sm text-gray-600 leading-6">
        <p>
          Hay dos botones de exportación, disponibles solo cuando el calendario está guardado y no tiene errores
          bloqueantes:
        </p>
        <List
          items={[
            {
              label: "Exportar Calendario",
              desc: "Genera un Excel con la vista mensual: filas por slot, columnas por día. Útil para imprimir o enviar internamente.",
            },
            {
              label: "Exportar Excel (RRHH)",
              desc: "Genera el Excel en el formato que usa RRHH: incluye RUT y nombre completo. Requiere que todos los slots estén asignados.",
            },
          ]}
        />
        <Warning>
          El Excel de RRHH no se puede generar si hay slots sin vendedor asignado. La app te avisará cuántos
          faltan. Asigna todos antes de exportar o usa Exportar Calendario como respaldo parcial.
        </Warning>
        <Tip>
          Al exportar se guarda automáticamente el calendario si tiene cambios pendientes, antes de generar el
          archivo.
        </Tip>
      </div>
    ),
  },
  {
    id: "bloqueos",
    icon: "🔒",
    title: "Bloqueos de vendedores",
    content: (
      <div className="space-y-2 text-sm text-gray-600 leading-6">
        <p>
          Un bloqueo indica que un vendedor no está disponible en un rango de fechas (vacaciones, licencia
          médica, permiso, etc.). Lo configura el administrador desde el detalle de la sucursal.
        </p>
        <List
          items={[
            {
              label: "Celda gris con texto Bloq.",
              desc: "Aparece en los días en que el vendedor tiene un bloqueo activo. El sistema no cuenta esas horas.",
            },
            {
              label: "Tooltip al pasar el cursor",
              desc: "Muestra el motivo del bloqueo si fue registrado.",
            },
            {
              label: "Celdas bloqueadas no son editables",
              desc: "No puedes asignar turnos a un vendedor bloqueado ni arrastrar hacia esas celdas.",
            },
          ]}
        />
        <Tip>
          Si un vendedor tiene un bloqueo pero ves que su turno igual aparece asignado, el calendario fue
          generado antes del bloqueo. Reinicia la asignación o edita manualmente ese día.
        </Tip>
      </div>
    ),
  },
  {
    id: "errores",
    icon: "❗",
    title: "Errores y advertencias comunes",
    content: (
      <div>
        <List
          items={[
            {
              label: "Falta categoría",
              desc: "El equipo no tiene categoría de turno asignada. El administrador debe configurarla desde la ficha de la sucursal. Sin categoría no se puede generar el calendario.",
            },
            {
              label: "Vendedor sin asignar",
              desc: "Hay uno o más slots sin vendedor. Puedes guardar igualmente como versión incompleta y completarlo después.",
            },
            {
              label: "No veo una sucursal",
              desc: "Puede que no esté asignada a tu usuario. Contacta al administrador para revisar los permisos.",
            },
            {
              label: "El calendario quedó en blanco al cambiar de mes",
              desc: "Es normal si ese mes aún no tiene calendario generado. Presiona Generar para crear la plantilla.",
            },
            {
              label: "Horario inválido en el editor",
              desc: "El turno cae fuera de la franja operativa o supera 10 horas netas. Ajusta usando los botones de ±1h o ±30min hasta que el resumen muestre horas válidas.",
            },
            {
              label: "No puedo mover un turno a ese día",
              desc: "El día destino no es laborable según el patrón (ej. domingo), o el movimiento generaría más de 6 días consecutivos.",
            },
            {
              label: "El botón Guardar está desactivado",
              desc: "No hay cambios pendientes o el calendario ya está guardado tal como está.",
            },
          ]}
        />
      </div>
    ),
  },
];

export default function SupervisorHelpPage() {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  function toggle(id: string) {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Cómo usar el calendario</h1>
        <p className="text-sm text-gray-500 mt-1">
          Guía completa para supervisores y jefes de sucursal. Haz click en cada sección para expandirla.
        </p>
      </div>

      <div className="space-y-2">
        {SECTIONS.map((sec) => {
          const isOpen = !!open[sec.id];
          return (
            <div key={sec.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggle(sec.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{sec.icon}</span>
                  <span className="text-sm font-semibold text-gray-800">{sec.title}</span>
                </div>
                <span className={`text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
                  ▾
                </span>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                  {sec.content}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-amber-900">¿Necesitas ayuda adicional?</h2>
        <p className="text-sm text-amber-800 mt-2 leading-6">
          Incluye: nombre de la sucursal o grupo, mes, qué acción estabas haciendo y una captura de pantalla si
          puedes. Con eso se puede revisar el historial mucho más rápido.
        </p>
        <p className="text-sm text-amber-800 mt-2">
          Contacto:{" "}
          <a href="mailto:danilo.prieto@pompeyo.cl" className="font-medium underline hover:text-amber-900">
            danilo.prieto@pompeyo.cl
          </a>
        </p>
      </div>
    </div>
  );
}
