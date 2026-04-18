# Formato de exportación Excel — Spec 007

Documenta el formato exacto del archivo `.xlsx` que genera el endpoint `POST /export`.

## Nombre del archivo

```
turnos_{codigo_area}_{nombre_sucursal_slug}_{YYYYMM}.xlsx
```

**Ejemplo real** (sucursal NISSAN IRARRÁZAVAL, mayo 2026):

```
turnos_1200_nissan-irarrazaval_202605.xlsx
```

Reglas del slug: minúsculas, tildes removidas (`á→a`, `ñ→n`, etc.), espacios y caracteres especiales reemplazados por `-`.

## Estructura de la hoja

- **Una sola hoja** por archivo.
- Nombre de la hoja: `{codigo_area}_{YYYYMM}` (ej: `1200_202605`).

## Fila de headers (fila 1)

| Columna | Valor    |
|---------|----------|
| A       | `RUT`    |
| B       | `DIA1`   |
| C       | `DIA2`   |
| …       | …        |
| últ.    | `DIA28` / `DIA29` / `DIA30` / `DIA31` según el mes |

La cantidad de columnas de días es exactamente la cantidad de días del mes (28–31). No se agregan columnas extra.

## Filas de datos (desde fila 2)

Una fila por trabajador que tenga **al menos un turno** en el mes.

| Columna A | Columnas B en adelante |
|-----------|------------------------|
| RUT **sin puntos ni dígito verificador** | Turno del día como `"HH:MM a HH:MM"`, o celda vacía si no trabaja ese día |

### RUT

- Formato interno en Appwrite: `XXXXXXXX-X` (con guión, DV en mayúsculas).
- En el Excel: solo el cuerpo numérico, sin guión ni DV.
  - `17286931-9` → `17286931`
  - `12345678-K` → `12345678`

### Turno

- Texto plano: `"HH:MM a HH:MM"` (ej: `"09:00 a 19:00"`).
- No son fórmulas ni formato de hora de Excel.
- Si el trabajador descansa ese día (o no tiene turno asignado): **celda vacía**.

### Trabajadores sin turnos

Los trabajadores que no aparecen en ningún turno del mes **no se incluyen** como filas. No hay filas vacías ni filas con RUT pero sin turnos.

## Ejemplo real

Generado con 3 trabajadores, sucursal `1200` (autopark), mayo 2026, turnos `09:00–19:00` y `10:00–20:00`:

| RUT      | DIA1 | DIA2          | DIA3 | DIA4          | DIA5          | DIA6          | DIA7          | DIA8          | … | DIA31 |
|----------|------|---------------|------|---------------|---------------|---------------|---------------|---------------|---|-------|
| 17286931 |      | 09:00 a 19:00 |      |               | 09:00 a 19:00 |               |               |               | … |       |
| 12345678 |      |               |      |               |               | 09:00 a 19:00 |               | 09:00 a 19:00 | … |       |
| 98765432 |      |               |      | 09:00 a 19:00 |               |               | 09:00 a 19:00 |               | … |       |

- DIA1 (2026-05-01) es feriado → sin turnos asignados.
- DIA21 (2026-05-21) es feriado → ídem.
- Columna hasta DIA31 porque mayo tiene 31 días.

## Reglas de formato

- Sin colores, bordes, filtros ni fórmulas.
- Sin columnas de totales, nombres ni resúmenes.
- Texto plano UTF-8 (nativo de openpyxl).
- Compatible con Excel 2016+ y Google Sheets.

## Flujo técnico

```
Frontend
  POST /export  { "proposal_id": "..." }
        ↓
Backend
  1. Valida JWT y permisos (admin: cualquier sucursal; jefe: solo sus sucursales)
  2. fetch_export_dataset(proposal_id)
       └─ get_proposal → valida estado == "seleccionada" | "exportada"
       └─ list_assignments_by_proposal → detecta slots sin worker_id → 422
       └─ get_branch, get_shift_catalog, list_workers_by_ids
  3. export_proposal_to_xlsx(dataset) → bytes
  4. Registra en audit_log (accion="export", fail-silent)
  5. Responde 200 con binario + Content-Disposition
        ↓
Frontend
  trigger-download.ts: blob → URL.createObjectURL → <a download> → click
```

## Precondiciones para exportar

El endpoint retorna error si:

| Condición | Código |
|-----------|--------|
| Propuesta no existe | `404` |
| Estado distinto de `seleccionada` o `exportada` | `422` |
| Hay slots sin trabajador asignado | `422` |
| Jefe intenta exportar sucursal ajena | `403` |

## Archivos relevantes

| Archivo | Rol |
|---------|-----|
| `backend/app/services/excel_exporter.py` | Genera el xlsx con openpyxl |
| `backend/app/services/proposal_fetcher.py` | Consolida datos desde Appwrite |
| `backend/app/services/appwrite_client.py` | Cliente server-side de Appwrite |
| `backend/app/api/routes.py` | Endpoint `POST /export` |
| `frontend/src/lib/export/trigger-download.ts` | Trigger de descarga en el cliente |
| `backend/tests/test_excel_exporter.py` | Tests unitarios del exporter |
| `backend/tests/test_export_e2e.py` | Test E2E completo |
