# Spec 001 — Modelo de Datos

## Contexto

Todas las funcionalidades del sistema se apoyan en un modelo de datos claro, consistente y versionado. Esta spec define las colecciones en Appwrite, sus atributos, índices y reglas de permisos, además de los tipos TypeScript y modelos Pydantic correspondientes en código.

## Objetivo

Dejar listo:
1. Colecciones de Appwrite con atributos, índices y permisos.
2. Script idempotente de "bootstrap" que crea todo desde cero en una Appwrite vacía.
3. Tipos TypeScript compartidos (`frontend/src/types/`) y modelos Pydantic (`backend/models/`) generados desde un schema único (JSON Schema o pydantic → TS).

## Alcance

### Dentro de alcance
- Colecciones: `users`, `branches`, `workers`, `branch_managers`, `holidays`, `shift_catalog`, `branch_type_config`, `worker_constraints`, `proposals`, `assignments`, `audit_log`.
- Script `scripts/bootstrap-appwrite.ts` que crea todo.
- Tipos compartidos entre frontend y backend.
- Seed inicial de `shift_catalog`, `branch_type_config` y `holidays` del año en curso.

### Fuera de alcance
- Lógica de negocio (eso está en otras specs).
- UI para editar registros (eso está en specs de admin panel).

## Colecciones

### 1. `users`

Usuarios de la aplicación. Sincronizados con Appwrite Auth.

| Atributo           | Tipo       | Req | Notas                                            |
|--------------------|------------|-----|--------------------------------------------------|
| `$id`              | string     | sí  | Mismo ID que en Appwrite Auth                    |
| `email`            | email      | sí  | Duplicado de Auth para queries sin round-trip    |
| `nombre_completo`  | string     | sí  |                                                  |
| `rut`              | string     | no  | Formato `XXXXXXXX-X` (opcional)                  |
| `rol`              | enum       | sí  | `admin` \| `jefe_sucursal`                       |
| `activo`           | boolean    | sí  | Default `true`. Soft delete.                     |

**Índices**:
- `email` (único)
- `rol`

**Permisos**:
- Lectura: admin (todos) | usuario (solo su propio doc)
- Escritura: admin

---

### 2. `branches`

Sucursales de la empresa.

| Atributo        | Tipo    | Req | Notas                                                 |
|-----------------|---------|-----|-------------------------------------------------------|
| `$id`           | string  | sí  | Generado por Appwrite                                 |
| `codigo_area`   | string  | sí  | Código numérico del Excel (ej: `"1200"`)              |
| `nombre`        | string  | sí  | Nombre legible (ej: `"NISSAN IRARRAZAVAL"`)           |
| `tipo_franja`   | enum    | sí  | `standalone` \| `autopark` \| `movicenter` \| `tqaoev` \| `sur` |
| `activa`        | boolean | sí  | Default `true`                                        |
| `creada_desde_excel` | boolean | sí | `true` si se creó auto al subir un Excel       |

**Índices**:
- `codigo_area` (único)
- `tipo_franja`

**Permisos**:
- Lectura: todos los usuarios autenticados
- Escritura: admin

---

### 3. `branch_type_config`

Configuración fija de cada tipo de franja. Datos **seed** (no se crean por UI salvo edge case).

| Atributo               | Tipo    | Req | Notas                                       |
|------------------------|---------|-----|---------------------------------------------|
| `$id`                  | string  | sí  | `"standalone"`, `"autopark"`, etc.          |
| `nombre_display`       | string  | sí  | `"Standalone"`                              |
| `franja_por_dia`       | JSON    | sí  | `{ "lunes": {"apertura":"09:00","cierre":"19:00"}, ... }` |
| `shifts_aplicables`    | array   | sí  | IDs de `shift_catalog` aplicables a este tipo |

**Permisos**:
- Lectura: todos
- Escritura: admin (raramente)

---

### 4. `shift_catalog`

Catálogo de turnos disponibles en el sistema. Datos **seed**.

| Atributo              | Tipo    | Req | Notas                                 |
|-----------------------|---------|-----|---------------------------------------|
| `$id`                 | string  | sí  | Ej: `"S_10_20"`, `"S_11_20"`          |
| `nombre_display`      | string  | sí  | `"10:00 a 20:00"`                     |
| `hora_inicio`         | string  | sí  | `"HH:MM"`                             |
| `hora_fin`            | string  | sí  | `"HH:MM"`                             |
| `duracion_minutos`    | integer | sí  | Duración bruta                        |
| `descuenta_colacion`  | boolean | sí  | `true` si ≥ 8h → resta 60 min         |
| `categoria`           | enum    | sí  | `principal` \| `adicional`            |

**Índices**:
- `categoria`

**Permisos**:
- Lectura: todos
- Escritura: admin

---

### 5. `workers`

Trabajadores/asesores de venta.

| Atributo            | Tipo    | Req | Notas                                          |
|---------------------|---------|-----|------------------------------------------------|
| `$id`               | string  | sí  | Generado por Appwrite                          |
| `rut`               | string  | sí  | Formato `XXXXXXXX-X` (único)                   |
| `nombre_completo`   | string  | sí  |                                                |
| `branch_id`         | string  | sí  | FK → `branches.$id`                            |
| `supervisor_nombre` | string  | no  | Del Excel, solo informativo                    |
| `activo`            | boolean | sí  | Default `true`                                 |
| `ultima_sync_excel` | datetime| no  | Para tracking de upserts                       |

**Índices**:
- `rut` (único)
- `branch_id`
- `activo`

**Permisos**:
- Lectura: admin (todos) | jefe_sucursal (solo los de sus branches)
- Escritura: admin

---

### 6. `branch_managers`

Relación N:N entre jefes de sucursal y sucursales.

| Atributo           | Tipo     | Req | Notas                                      |
|--------------------|----------|-----|--------------------------------------------|
| `$id`              | string   | sí  |                                            |
| `user_id`          | string   | sí  | FK → `users.$id`                           |
| `branch_id`        | string   | sí  | FK → `branches.$id`                        |
| `asignado_desde`   | datetime | sí  |                                            |
| `asignado_hasta`   | datetime | no  | null = vigente                             |

**Índices**:
- `user_id`
- `branch_id`
- Compuesto `(user_id, branch_id)` único para vigentes

**Permisos**:
- Lectura: admin (todas) | jefe_sucursal (solo sus filas)
- Escritura: admin

---

### 7. `holidays`

Feriados irrenunciables chilenos. Datos **seed** anuales.

| Atributo        | Tipo     | Req | Notas                                        |
|-----------------|----------|-----|----------------------------------------------|
| `$id`           | string   | sí  |                                              |
| `fecha`         | datetime | sí  | Fecha exacta del feriado                     |
| `nombre`        | string   | sí  | `"Día del Trabajador"`                       |
| `tipo`          | enum     | sí  | `irrenunciable` (único valor por ahora)      |
| `anio`          | integer  | sí  | Denormalizado para queries rápidas           |

**Índices**:
- `fecha` (único)
- `anio`

**Permisos**:
- Lectura: todos
- Escritura: admin

---

### 8. `worker_constraints`

Excepciones individuales por trabajador.

| Atributo        | Tipo     | Req | Notas                                                      |
|-----------------|----------|-----|------------------------------------------------------------|
| `$id`           | string   | sí  |                                                            |
| `worker_id`     | string   | sí  | FK → `workers.$id`                                         |
| `tipo`          | enum     | sí  | `dia_prohibido` \| `turno_prohibido` \| `vacaciones`       |
| `valor`         | string   | no  | `"martes"` para dia_prohibido, shift_id para turno_prohibido |
| `fecha_desde`   | datetime | no  | Solo para `vacaciones`                                     |
| `fecha_hasta`   | datetime | no  | Solo para `vacaciones`                                     |
| `notas`         | string   | no  | Texto libre                                                |
| `creado_por`    | string   | sí  | FK → `users.$id`                                           |

**Índices**:
- `worker_id`
- `tipo`

**Permisos**:
- Lectura: admin | jefe_sucursal (solo los de sus workers)
- Escritura: admin

---

### 9. `proposals`

Propuestas de turnero generadas por el optimizador.

| Atributo              | Tipo     | Req | Notas                                         |
|-----------------------|----------|-----|-----------------------------------------------|
| `$id`                 | string   | sí  |                                               |
| `branch_id`           | string   | sí  | FK → `branches.$id`                           |
| `anio`                | integer  | sí  |                                               |
| `mes`                 | integer  | sí  | 1–12                                          |
| `modo`                | enum     | sí  | `ilp` \| `greedy`                             |
| `score`               | float    | sí  | Valor de la función objetivo                  |
| `factible`            | boolean  | sí  |                                               |
| `asignaciones`        | JSON     | sí  | Array `[{slot, date, shift_id}]`              |
| `dotacion_sugerida`   | integer  | sí  | Mínimo calculado                              |
| `parametros`          | JSON     | sí  | Parámetros con los que se generó              |
| `estado`              | enum     | sí  | `generada` \| `seleccionada` \| `descartada`  |
| `creada_por`          | string   | sí  | FK → `users.$id`                              |
| `seleccionada_por`    | string   | no  | FK → `users.$id` (jefe o admin)               |

**Índices**:
- Compuesto `(branch_id, anio, mes)`
- `estado`

**Permisos**:
- Lectura: admin | jefe_sucursal (solo de sus branches)
- Escritura: admin (crear) | admin + jefe_sucursal (actualizar `estado`)

---

### 10. `assignments`

Asignación final de trabajadores a slots de una propuesta seleccionada. Una fila por (propuesta, slot).

| Atributo       | Tipo    | Req | Notas                                       |
|----------------|---------|-----|---------------------------------------------|
| `$id`          | string  | sí  |                                             |
| `proposal_id`  | string  | sí  | FK → `proposals.$id`                        |
| `slot_numero`  | integer | sí  | 1, 2, 3, …                                  |
| `worker_id`    | string  | no  | FK → `workers.$id`. Null si no asignado     |
| `asignado_por` | string  | no  | FK → `users.$id`                            |
| `asignado_en`  | datetime| no  |                                             |

**Índices**:
- `proposal_id`
- Compuesto `(proposal_id, slot_numero)` único

**Permisos**:
- Lectura: admin | jefe_sucursal (sus branches)
- Escritura: admin | jefe_sucursal (sus branches)

---

### 11. `audit_log`

Log auditable de operaciones críticas.

| Atributo       | Tipo     | Req | Notas                                                |
|----------------|----------|-----|------------------------------------------------------|
| `$id`          | string   | sí  |                                                      |
| `user_id`      | string   | sí  |                                                      |
| `accion`       | string   | sí  | Ej: `upload_excel`, `generate_proposal`, `export`    |
| `entidad`      | string   | no  | Ej: `branch`, `proposal`                             |
| `entidad_id`   | string   | no  |                                                      |
| `metadata`     | JSON     | no  | Contexto adicional                                   |
| `$createdAt`   | datetime | sí  | Auto                                                 |

**Índices**:
- `user_id`
- `accion`
- `$createdAt`

**Permisos**:
- Lectura: admin
- Escritura: admin (vía backend)

---

## Tipos TypeScript

Serán generados automáticamente desde el bootstrap. Estructura esperada:

```typescript
// frontend/src/types/models.ts

export type Rol = "admin" | "jefe_sucursal";
export type TipoFranja = "standalone" | "autopark" | "movicenter" | "tqaoev" | "sur";
export type DiaSemana = "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado" | "domingo";

export interface User { /* ... */ }
export interface Branch { /* ... */ }
// ... etc.
```

## Modelos Pydantic

Espejo para el backend:

```python
# backend/models/schemas.py
from pydantic import BaseModel
from enum import Enum

class Rol(str, Enum):
    admin = "admin"
    jefe_sucursal = "jefe_sucursal"

class TipoFranja(str, Enum):
    standalone = "standalone"
    autopark = "autopark"
    movicenter = "movicenter"
    tqaoev = "tqaoev"
    sur = "sur"

# ... etc.
```

## Criterios de aceptación

- [ ] El script `scripts/bootstrap-appwrite.ts` corre exitosamente en una Appwrite vacía.
- [ ] El script es idempotente: correrlo 2 veces no duplica colecciones ni atributos.
- [ ] `shift_catalog`, `branch_type_config` y `holidays` (año actual + siguiente) quedan con seed.
- [ ] Los tipos TS y Pydantic están generados y compilan sin errores.
- [ ] Hay un admin inicial creado vía CLI, con su label.
