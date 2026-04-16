# Spec 007 — Exportación a Excel

## Contexto

El turnero final debe exportarse a un Excel con un formato muy específico requerido por los sistemas downstream de la empresa.

## Objetivo

Dado una propuesta seleccionada con todos sus slots asignados a trabajadores reales, generar y descargar un archivo `.xlsx` con el formato especificado.

## Formato del Excel

### Estructura

- **Una hoja por sucursal/mes**. El nombre de la hoja: `{codigo_area}_{YYYYMM}` (ej: `1200_202605`).
- **Primera fila**: headers.
  - `A1` = `"RUT"`
  - `B1` = `"DIA1"`
  - `C1` = `"DIA2"`
  - … hasta el último día del mes (DIA28/29/30/31 según corresponda).
- **Desde la fila 2**, una fila por trabajador asignado en el mes.
  - Columna A: RUT **sin puntos ni dígito verificador**. Ej: `17286931` (no `17.286.931-9`).
  - Columnas B en adelante: el turno de ese día como texto `"HH:MM a HH:MM"`, ej: `"10:00 a 20:00"`.
  - Si el trabajador no tiene turno ese día (descanso, vacaciones, no era su sucursal, etc.): celda **vacía**.

### Ejemplo visual

| RUT      | DIA1          | DIA2          | DIA3 | DIA4          | ... | DIA31         |
|----------|---------------|---------------|------|---------------|-----|---------------|
| 17286931 | 10:00 a 20:00 | 10:00 a 20:00 |      | 11:00 a 20:00 | ... | 10:00 a 14:00 |
| 19514019 | 11:00 a 20:00 |               |      | 10:00 a 20:00 | ... |               |

### Reglas de contenido

- Si el trabajador no aparece en ningún turno del mes → **no se incluye** en el Excel (no filas vacías).
- Las celdas son texto plano, no fórmulas, no formato de hora.
- El mes siempre ocupa 28-31 columnas según el mes real. Febrero tiene DIA1..DIA28/29, abril 30, etc.
- **No** se agregan columnas de totales, nombres, resúmenes, etc.
- **No** se agregan formatos de color, bordes, ni filtros.
- Codificación: UTF-8 en el XML del xlsx (nativo de openpyxl).

## Flujo

### Opción A: export en el backend (recomendado)

```
Frontend: POST /export
  body: { proposal_id }
Backend:
  1. Valida JWT y permisos
  2. Carga propuesta + assignments desde Appwrite (el backend tiene API Key)
  3. Construye el Excel con openpyxl
  4. Responde con el binario + header Content-Disposition
Frontend: trigger download
```

### Opción B: export en el frontend (alternativa)

Generar el Excel en el cliente con SheetJS. Ventaja: no requiere que backend hable con Appwrite. Desventaja: más lógica de negocio en cliente.

**Decisión**: **Opción A**, por:
- Separación de concerns.
- El backend YA tiene que hablar con Appwrite para validar permisos.
- openpyxl es más preciso con formatos que SheetJS.

## Permisos

- Admin: exportar cualquier sucursal.
- Jefe: solo exportar sus sucursales asignadas.
- El backend valida el JWT y pertenencia a branch antes de exportar.

## Nombre del archivo descargado

```
turnos_{codigo_area}_{nombre_sucursal_slug}_{YYYYMM}.xlsx
```

Ejemplo: `turnos_1200_nissan-irarrazaval_202605.xlsx`.

## Precondición

El botón "Exportar" en el calendario (Spec 004) está deshabilitado si:
- Hay violaciones en la propuesta activa.
- Hay slots sin asignar (Trabajador N sin nombre real).

## Criterios de aceptación

- [ ] Se descarga un `.xlsx` válido al hacer click en "Exportar".
- [ ] El archivo cumple exactamente el formato (headers, celdas vacías, sin DV en RUT).
- [ ] Abre sin errores en Excel y Google Sheets.
- [ ] Meses con distinta cantidad de días generan la cantidad correcta de columnas.
- [ ] Un jefe no puede exportar una sucursal que no es suya.
- [ ] La exportación registra en `audit_log`.
