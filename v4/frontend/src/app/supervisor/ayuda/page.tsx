"use client";

import { useState } from "react";

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

interface StepProps {
  number: number;
  icon: string;
  title: string;
  children: React.ReactNode;
  open: boolean;
  onToggle: () => void;
}

function Step({ number, icon, title, children, open, onToggle }: StepProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">
          {number}
        </div>
        <span className="text-base mr-0.5">{icon}</span>
        <span className="text-sm font-semibold text-gray-800 flex-1">{title}</span>
        <span className={`text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 text-sm text-gray-600 leading-6 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}

interface RefProps {
  icon: string;
  title: string;
  children: React.ReactNode;
  open: boolean;
  onToggle: () => void;
}

function RefSection({ icon, title, children, open, onToggle }: RefProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-base">{icon}</span>
        <span className="text-sm font-semibold text-gray-800 flex-1">{title}</span>
        <span className={`text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 text-sm text-gray-600 leading-6 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}

function Item({ label, desc }: { label: string; desc: string }) {
  return (
    <li className="text-sm text-gray-600 leading-6">
      <span className="font-medium text-gray-800">{label}:</span> {desc}
    </li>
  );
}

export default function SupervisorHelpPage() {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpen((p) => ({ ...p, [id]: !p[id] }));

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Cómo usar el calendario</h1>
        <p className="text-sm text-gray-500 mt-1">
          Sigue estos pasos en orden para generar y publicar el calendario de tu sucursal cada mes.
        </p>
      </div>

      {/* ── PASOS ── */}
      <div className="space-y-2">

        <Step number={1} icon="🏠" title="Entra a tu sucursal" open={!!open["1"]} onToggle={() => toggle("1")}>
          <p>
            En la pantalla de inicio (<strong>Mis sucursales</strong>) verás las sucursales asignadas a tu
            usuario. Haz click en la tarjeta de la sucursal para abrir su calendario.
          </p>
          <p>
            Si administras varias sucursales, puedes activar los{" "}
            <strong>checkboxes</strong> de dos o más y presionar{" "}
            <strong>Asignación de turnos</strong> para verlas combinadas en una sola pantalla.
          </p>
          <Tip>
            Si una sucursal no aparece, pide al administrador que revise tus permisos. Solo ves lo que está
            asignado a tu usuario.
          </Tip>
        </Step>

        <Step number={2} icon="📅" title="Elige el mes a trabajar" open={!!open["2"]} onToggle={() => toggle("2")}>
          <p>
            Dentro del calendario hay un selector de <strong>mes</strong> y <strong>año</strong> en la
            esquina superior derecha. Cámbialo para navegar a otro período.
          </p>
          <p>
            Si tienes cambios sin guardar, la app te preguntará si deseas guardarlos antes de cambiar de mes.
            Responde <strong>Guardar y salir</strong> para conservarlos o{" "}
            <strong>Salir sin guardar</strong> para descartar.
          </p>
          <Warning>
            Cerrar la pestaña del navegador con cambios sin guardar disparará el aviso del navegador. Usa
            siempre los botones de la app para navegar sin perder trabajo.
          </Warning>
        </Step>

        <Step number={3} icon="⚙️" title="Genera la plantilla del mes" open={!!open["3"]} onToggle={() => toggle("3")}>
          <p>
            Si el calendario del mes aún no existe, verás el botón <strong>Generar</strong>. Presiónalo para
            crear la plantilla de turnos y asignar a los vendedores automáticamente en orden.
          </p>
          <p>
            Si el calendario ya existe y quieres rehacerlo desde cero, usa <strong>Reiniciar</strong>: borra
            todas las asignaciones de vendedores dejando los slots vacíos, pero conserva la estructura de
            horarios.
          </p>
          <Warning>
            Reiniciar es irreversible: borra todas las asignaciones del mes. La app te pedirá confirmación
            antes de proceder.
          </Warning>
          <Tip>
            Si no aparece el botón Generar y el calendario está vacío, puede que la sucursal no tenga
            categoría de turno asignada. El administrador debe configurarla desde la ficha de la sucursal.
          </Tip>
        </Step>

        <Step number={4} icon="👤" title="Asigna los vendedores a cada slot" open={!!open["4"]} onToggle={() => toggle("4")}>
          <p>
            Cada fila del calendario es un <strong>slot</strong> (posición de turno). Al generar, los
            vendedores se asignan automáticamente en orden, pero puedes cambiarlos manualmente.
          </p>
          <p>
            Para cambiar o asignar un vendedor, haz click en el <strong>nombre en la columna
            izquierda</strong> (vista Mensual) o en el <strong>header de color</strong> (vista Turno por
            Vendedor). Se abrirá un listado con los vendedores disponibles.
          </p>
          <ul className="mt-2 space-y-1.5 list-none">
            <Item label="Actual" desc="El vendedor asignado aparece marcado. Haz click en él si no quieres cambiarlo." />
            <Item label="Quitar asignación" desc="Botón rojo al pie del diálogo. Deja el slot vacío." />
            <Item label="No aparece un vendedor" desc="Puede que ya esté asignado en otro slot. Búscalo en el calendario y quítalo de ahí primero." />
          </ul>
        </Step>

        <Step number={5} icon="✏️" title="Ajusta los horarios si es necesario" open={!!open["5"]} onToggle={() => toggle("5")}>
          <p>
            Haz click en cualquier <strong>celda de turno</strong> para abrir el editor de horario de ese día.
          </p>
          <ul className="mt-2 space-y-1.5 list-none">
            <Item label="◀ Atrasar / Adelantar 1h ▶" desc="Mueve el turno completo 60 minutos. Los botones se desactivan si se sale de la franja operativa." />
            <Item label="◀ 30 min / 30 min ▶" desc="Igual, pero en incrementos de 30 minutos." />
            <Item label="Inputs manuales" desc="Escribe la hora exacta. La app valida que esté dentro de la franja y no supere 10 horas netas." />
            <Item label="Redistribuir horas" desc="Si acortas un turno, la app te pregunta si quieres agregar esas horas a otro día de la misma semana para compensar." />
          </ul>
          <Warning>
            Cada sucursal tiene una franja operativa (ej. 09:00–19:00). No se pueden ingresar horarios fuera
            de ese rango ni turnos que superen 10 horas netas. El botón Guardar se desactiva si el horario no
            es válido.
          </Warning>
        </Step>

        <Step number={6} icon="↔️" title="Reordena días con drag & drop" open={!!open["6"]} onToggle={() => toggle("6")}>
          <p>
            Puedes <strong>arrastrar una celda de turno</strong> a otro día dentro de la misma semana para
            intercambiar días. Funciona tanto en la vista Mensual como en Turno por Vendedor.
          </p>
          <ul className="mt-2 space-y-1.5 list-none">
            <Item label="Turno → día libre" desc="El turno se mueve; el día original queda libre." />
            <Item label="Turno → otro turno" desc="Ambos días intercambian sus turnos." />
          </ul>
          <Warning>
            No se puede mover un turno a un día que la sucursal no opera (ej. domingo si el patrón no
            incluye domingos), ni si el movimiento genera más de 6 días laborales consecutivos.
          </Warning>
          <Tip>
            En calendarios ya guardados, los días anteriores a hoy están bloqueados y no se pueden arrastrar
            ni editar.
          </Tip>
        </Step>

        <Step number={7} icon="📈" title="Revisa la cobertura del día" open={!!open["7"]} onToggle={() => toggle("7")}>
          <p>
            Cambia a la pestaña <strong>Cobertura del Día</strong> para ver un Gantt por día. Muestra quién
            trabaja en cada hora y facilita detectar huecos o solapamientos.
          </p>
          <ul className="mt-2 space-y-1.5 list-none">
            <Item label="Mini-calendario filtro" desc="Activa o desactiva días para enfocarte en fines de semana o fechas específicas." />
            <Item label="Barras horizontales" desc="Cada barra es el turno de un vendedor. El ancho representa la duración." />
            <Item label="Días en rojo" desc="Son feriados irrenunciables (1 enero, 1 mayo, 18-19 sep, 25 dic). Nadie trabaja esos días." />
          </ul>
          <Tip>
            Esta vista es solo lectura. Para hacer cambios, vuelve a Calendario Mensual o Turno por Vendedor.
          </Tip>
        </Step>

        <Step number={8} icon="💾" title="Guarda el calendario" open={!!open["8"]} onToggle={() => toggle("8")}>
          <p>
            Presiona <strong>Guardar</strong> para confirmar todos los cambios. RRHH recibirá una
            notificación automática con el calendario adjunto.
          </p>
          <p>
            Si hay vendedores sin asignar, puedes guardar igual como <strong>versión incompleta</strong> para
            dejar respaldo y completarlo después. La app te preguntará antes.
          </p>
          <Tip>
            El botón Guardar solo está activo cuando hay cambios pendientes. Si está gris, el calendario ya
            está actualizado en el servidor.
          </Tip>
        </Step>

        <Step number={9} icon="📥" title="Exporta si necesitas enviar el Excel" open={!!open["9"]} onToggle={() => toggle("9")}>
          <p>
            Hay dos botones de exportación disponibles una vez guardado el calendario:
          </p>
          <ul className="mt-2 space-y-1.5 list-none">
            <Item label="Exportar Calendario" desc="Excel con la vista mensual: filas por slot, columnas por día. Útil para imprimir o enviar internamente." />
            <Item label="Exportar Excel (RRHH)" desc="Formato oficial RRHH con RUT y nombre completo. Requiere que todos los slots tengan vendedor asignado." />
          </ul>
          <Warning>
            El Excel de RRHH no se puede generar con slots vacíos. Asigna todos los vendedores antes de
            exportar, o usa Exportar Calendario como respaldo parcial.
          </Warning>
        </Step>

      </div>

      {/* ── REFERENCIA ── */}
      <div className="mt-6 mb-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Referencia adicional</p>
      </div>
      <div className="space-y-2">

        <RefSection icon="👁️" title="Las tres pestañas del calendario" open={!!open["tabs"]} onToggle={() => toggle("tabs")}>
          <ul className="space-y-2">
            <Item
              label="Calendario Mensual"
              desc="Vista principal por semana. Un slot por fila, un día por columna. Click en el encabezado de un día muestra el Gantt de ese día debajo de la tabla."
            />
            <Item
              label="Turno por Vendedor"
              desc="Mini-calendario individual por cada vendedor. Ideal para revisar el mes completo de una persona. Filtra con los chips en la parte superior."
            />
            <Item
              label="Cobertura del Día"
              desc="Gantt horizontal de todos los días del mes. Solo lectura. Para filtrar días usa el mini-calendario de la parte superior."
            />
          </ul>
        </RefSection>

        <RefSection icon="🏢" title="Grupos de sucursales" open={!!open["grupos"]} onToggle={() => toggle("grupos")}>
          <p>
            Cuando seleccionas varias sucursales en la pantalla de inicio y creas un grupo, el sistema muestra
            un calendario combinado separado por área de negocio (Ventas / Postventa).
          </p>
          <ul className="mt-2 space-y-1.5">
            <Item label="Guardar grupo" desc="Al guardar, se registran los calendarios de cada equipo por separado. RRHH recibe un Excel consolidado." />
            <Item label="Disolver un grupo" desc="Solo el administrador puede hacerlo desde /admin/grupos." />
          </ul>
          <Tip>Una sucursal solo puede pertenecer a un grupo a la vez.</Tip>
        </RefSection>

        <RefSection icon="🔒" title="Bloqueos de vendedores" open={!!open["bloqueos"]} onToggle={() => toggle("bloqueos")}>
          <p>
            Un bloqueo indica que un vendedor no está disponible en un rango de fechas (vacaciones, licencia
            médica, permiso). Lo configura el administrador.
          </p>
          <ul className="mt-2 space-y-1.5">
            <Item label="Celda gris con Bloq." desc="El vendedor tiene un bloqueo activo ese día. El sistema no cuenta esas horas." />
            <Item label="Tooltip" desc="Pasa el cursor por la celda para ver el motivo del bloqueo." />
          </ul>
          <Tip>
            Si un vendedor tiene bloqueo pero aparece con turno asignado, el calendario se generó antes de
            registrar el bloqueo. Edita ese día o reinicia la asignación.
          </Tip>
        </RefSection>

        <RefSection icon="❗" title="Errores y problemas comunes" open={!!open["errores"]} onToggle={() => toggle("errores")}>
          <ul className="space-y-2">
            <Item label="Falta categoría" desc="El equipo no tiene categoría de turno. El administrador debe asignarla desde la ficha de la sucursal. Sin ella no se puede generar el calendario." />
            <Item label="Vendedor sin asignar" desc="Hay slots vacíos. Puedes guardar como versión incompleta y completarlo después." />
            <Item label="No veo una sucursal" desc="Puede que no esté asignada a tu usuario. Contacta al administrador." />
            <Item label="Calendario en blanco al cambiar mes" desc="Ese mes no tiene calendario. Presiona Generar para crear la plantilla." />
            <Item label="Horario inválido en el editor" desc="El turno cae fuera de la franja operativa o supera 10 horas netas. Ajusta con los botones de ±1h o ±30min." />
            <Item label="No puedo mover un turno" desc="El día destino no es laborable según el patrón, o el movimiento generaría más de 6 días consecutivos." />
            <Item label="Botón Guardar desactivado" desc="No hay cambios pendientes. El calendario ya está actualizado." />
          </ul>
        </RefSection>

      </div>

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-amber-900">¿Necesitas ayuda adicional?</h2>
        <p className="text-sm text-amber-800 mt-2 leading-6">
          Incluye: nombre de la sucursal o grupo, mes, qué acción estabas haciendo y una captura de pantalla.
          Con eso se puede revisar el historial mucho más rápido.
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
