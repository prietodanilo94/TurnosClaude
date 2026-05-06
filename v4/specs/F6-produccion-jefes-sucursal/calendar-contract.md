# F6 - CalendarView contract

`CalendarView` es el calendario base de produccion. Admin y supervisor deben reutilizarlo para evitar experiencias distintas.

## Regla principal

No crear un calendario mensual paralelo para roles nuevos sin aprobacion explicita.

Si un rol necesita guardar, generar, navegar o validar de manera distinta, debe usar props/wrappers sobre `CalendarView`.

## Capacidades que deben mantenerse

- Pestana `Calendario Mensual`.
- Pestana `Turno por Vendedor`.
- Pestana `Cobertura del Dia`.
- Colores por vendedor/slot.
- Click en vendedor para asignar o cambiar.
- Click en turno para editar horario.
- Click en dia para revisar cobertura/Gantt.
- Guardar cambios.
- Generar/regenerar con confirmacion.
- Panel de validacion cuando el rol lo requiera.

## Props de extension permitidas

- `backHref` y `backLabel`: cambian el link de vuelta segun rol.
- `onNavigate`: personaliza la URL al cambiar mes/anio.
- `onSaveCalendar`: permite guardar con logica especial, por ejemplo separar un grupo por equipos.
- `onRecalculateCalendar`: permite generar/regenerar con logica especial.
- `recalculateLabel`: cambia texto del boton.
- `recalculateConfirmMessage`: cambia confirmacion.
- `showExportButtons`: oculta exportacion cuando el flujo aun no esta listo.
- `showValidationPanel`: muestra revision del calendario cuando un flujo lo necesita.
- `enforceValidationBeforeSave`: en supervisor confirma antes de guardar una version incompleta si hay errores.

## Flujo supervisor

Supervisor debe usar un wrapper delgado:

- Convierte trabajadores simples a `WorkerInfo`.
- Combina o separa equipos si es grupo.
- Usa `CalendarView` para toda la UI.
- Mantiene `showValidationPanel` apagado para evitar avisos permanentes.
- Activa `enforceValidationBeforeSave` para confirmar guardado incompleto al presionar Guardar.
- Oculta exportacion mientras no exista exportacion multi-hoja de grupo.

## Reversion segura

Si un cambio rompe supervisor, no crear una nueva tabla rapida. Revisar primero:

1. Props pasadas por `SupervisorCalendarView`.
2. Contrato de `onSaveCalendar`.
3. Contrato de `onRecalculateCalendar`.
4. Validaciones de `validateCalendarForPublish()`.

Solo si `CalendarView` no puede soportar el caso, documentar el motivo en F6 antes de crear un componente nuevo.
