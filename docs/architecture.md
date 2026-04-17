# Arquitectura

## Visión de componentes

```
┌────────────────────────────────────────────────────────────────┐
│                         NAVEGADOR                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Next.js App (SSR + Client components)                    │  │
│  │                                                           │  │
│  │  • Login (Appwrite Web SDK)                               │  │
│  │  • Admin panel                                            │  │
│  │    - Gestión de sucursales y tipos                        │  │
│  │    - Upload Excel dotación                                │  │
│  │    - Gestión de jefes de sucursal                         │  │
│  │    - Gestión de excepciones por trabajador                │  │
│  │    - Generación de propuestas                             │  │
│  │  • Panel jefe de sucursal                                 │  │
│  │    - Ver sus sucursales                                   │  │
│  │    - Elegir propuesta                                     │  │
│  │    - Asignar trabajadores a slots                         │  │
│  │  • Calendario mensual (FullCalendar)                      │  │
│  │    - Drag & drop                                          │  │
│  │    - Contador de horas en vivo                            │  │
│  │    - Validaciones visuales                                │  │
│  │  • Export Excel (descarga desde backend)                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────┬────────────────────────────────────┬────────────────┘
           │                                    │
           │ HTTPS (Appwrite SDK)                │ HTTPS (REST JSON)
           ▼                                    ▼
┌──────────────────────────┐      ┌────────────────────────────────┐
│   APPWRITE (self-host)    │      │   FASTAPI + OR-TOOLS (Python)  │
│   ────────────────────    │      │   ──────────────────────────   │
│   • Auth (email+password) │      │   • POST /optimize              │
│   • Database              │      │     - ILP (OR-Tools CP-SAT)     │
│     - users               │      │     - Greedy heuristic          │
│     - branches            │      │   • POST /validate              │
│     - workers             │      │     - Verifica constraints      │
│     - branch_managers     │      │   • GET  /health                │
│     - holidays            │      │                                 │
│     - worker_constraints  │      │   Sin estado propio.            │
│     - proposals           │      │   Recibe JSON con dotación +    │
│     - assignments         │      │   restricciones y devuelve      │
│     - shift_catalog       │      │   JSON con asignaciones.        │
│     - audit_log           │      │                                 │
│   • Storage (Excel files) │      └────────────────────────────────┘
└──────────────────────────┘                      ▲
           ▲                                       │
           │ Solo frontend escribe/lee Appwrite    │
           │ (auth validada en cada request)       │
           │                                       │
           │     Backend NO habla con Appwrite ────┘
           │     (salvo para validar el JWT del caller si activamos)
           │
           │     Stateless: toda la data llega por el body del request
```

### Por qué el backend es stateless

El optimizador no necesita su propia base de datos. El frontend, que ya tiene acceso a Appwrite, construye el payload completo (trabajadores + restricciones + feriados + catálogo de turnos + parámetros) y lo envía. El backend computa y devuelve. Esto:

- Simplifica seguridad (un solo lugar de verdad: Appwrite).
- Facilita escalar (podemos levantar N réplicas del optimizador sin coordinación).
- Hace el backend trivialmente testeable con JSON fixtures.

---

## Flujo principal end-to-end

1. **Login**: el usuario entra con email/password vía Appwrite Auth. Se guarda un JWT en cookie segura.
2. **Admin sube Excel**: el frontend parsea el Excel con SheetJS, muestra preview, y ejecuta sincronización contra la colección `workers` (crear / actualizar / desactivar).
3. **Admin selecciona sucursal + mes + tipo de franja**: desde la UI, el admin escoge `branch_id`, `year`, `month`. Si la sucursal no tiene `tipo_franja` seteado, se le pregunta en ese momento y se guarda.
4. **Frontend construye payload**: arma un JSON con trabajadores activos de esa sucursal, restricciones individuales, feriados que caen en ese mes, catálogo de turnos aplicable al tipo de franja, y parámetros (modo `ilp`/`greedy`, mínimo peak, N propuestas).
5. **Frontend llama `POST /optimize`**: envía el payload al backend.
6. **Backend resuelve**: corre ILP o greedy y devuelve propuestas. Cada propuesta contiene asignaciones `{worker_slot, worker_rut, date, shift_id}`. El backend trabaja con trabajadores **reales** (con sus restricciones individuales); `worker_slot` es solo un índice de presentación (1..N según el orden en que llegaron en el request).
7. **Frontend guarda propuestas**: crea documentos en la colección `proposals` con las asignaciones (incluyendo `worker_rut`). Los slots sirven para mostrar "Trabajador 1, 2, 3..." en el calendario sin revelar nombres a quien no deba verlos.
8. **Admin o jefe revisa y edita**: abre el calendario mensual con FullCalendar. Ve los slots numerados (o los nombres reales si tiene permiso). Puede arrastrar turnos; cada cambio llama a `POST /validate` para feedback inmediato.
9. **Jefe reasigna si necesita**: si quiere intercambiar dos trabajadores dentro de la propuesta lo hace manualmente; el resultado se guarda en `assignments`.
10. **Export**: el frontend llama a `GET /export/{proposal_id}`. El **backend** genera el Excel con openpyxl y lo devuelve como descarga. Si la propuesta tiene violaciones, el backend retorna el archivo con un tab de advertencias; solo bloquea el export si hay días sin cobertura (violación crítica).

---

## Modelo de comunicación frontend ↔ backend

### Endpoint único crítico: `POST /optimize`

**Request body**:
```json
{
  "branch": {
    "id": "branch_1200",
    "codigo_area": "1200",
    "nombre": "NISSAN IRARRAZAVAL",
    "tipo_franja": "autopark"
  },
  "month": { "year": 2026, "month": 5 },
  "workers": [
    {
      "rut": "17286931-9",
      "nombre": "ABARZUA VARGAS ANDREA",
      "constraints": [
        { "tipo": "dia_prohibido", "valor": "martes" },
        { "tipo": "vacaciones", "desde": "2026-05-10", "hasta": "2026-05-20" }
      ]
    }
  ],
  "holidays": ["2026-05-01"],
  "shift_catalog": [
    { "id": "S_10_20", "inicio": "10:00", "fin": "20:00", "duracion_minutos": 600, "descuenta_colacion": true }
  ],
  "franja_por_dia": {
    "lunes":    { "apertura": "09:00", "cierre": "19:00" },
    "martes":   { "apertura": "09:00", "cierre": "19:00" },
    "miercoles":{ "apertura": "09:00", "cierre": "19:00" },
    "jueves":   { "apertura": "09:00", "cierre": "19:00" },
    "viernes":  { "apertura": "09:00", "cierre": "19:00" },
    "sabado":   { "apertura": "09:00", "cierre": "19:00" },
    "domingo":  null
  },
  "parametros": {
    "modo": "ilp",
    "num_propuestas": 3,
    "horas_semanales_max": 42,
    "horas_semanales_obj": 42,
    "peak_desde": "17:00",
    "cobertura_minima": 1,
    "priorizar_fin_de_semana": true,
    "dias_maximos_consecutivos": 6,
    "domingos_libres_minimos": 2
  }
}
```

**Response body**:
```json
{
  "propuestas": [
    {
      "id": "prop_1",
      "modo": "ilp",
      "score": 98.7,
      "factible": true,
      "dotacion_minima_sugerida": 5,
      "asignaciones": [
        { "worker_slot": 1, "worker_rut": "17286931-9", "date": "2026-05-02", "shift_id": "S_10_20" }
      ],
      "resumen_horas_por_trabajador": {
        "17286931-9": { "semana_1": 42, "semana_2": 40, "semana_3": 42, "semana_4": 42 }
      },
      "cobertura_por_dia": {
        "2026-05-02": { "horas_cubiertas": 10, "horas_requeridas": 10, "max_simultaneos": 2 }
      }
    }
  ],
  "diagnostico": {
    "dotacion_disponible": 6,
    "dotacion_minima_requerida": 5,
    "dotacion_suficiente": true,
    "mensajes": []
  }
}
```

---

## Seguridad

### Autenticación
- Appwrite emite JWT al hacer login.
- El frontend adjunta el JWT al llamar al backend FastAPI.
- FastAPI valida el JWT usando el API key de Appwrite (server-side verification).

### Autorización
- Admin → acceso total.
- Jefe de sucursal → solo lee/escribe sobre sucursales donde está listado en `branch_managers` con `asignado_hasta = null`.
- Appwrite aplica las reglas de permisos a nivel de documento usando `$permissions`.

### Datos sensibles
- Los RUT son datos personales → no se exponen en URLs.
- El Excel de dotación queda en Appwrite Storage con permisos de solo admin.
- Las contraseñas nunca tocan nuestro código; las maneja Appwrite Auth.

---

## Despliegue (Docker Compose)

```yaml
# docker-compose.yml (a generar en Entrega 2)
services:
  optimizer:
    build: ./backend
    ports: ["8000:8000"]
    environment:
      - APPWRITE_ENDPOINT=...
      - APPWRITE_PROJECT_ID=...
      - APPWRITE_API_KEY=...

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      - NEXT_PUBLIC_APPWRITE_ENDPOINT=...
      - NEXT_PUBLIC_APPWRITE_PROJECT_ID=...
      - NEXT_PUBLIC_OPTIMIZER_URL=http://optimizer:8000
```

Appwrite ya corre aparte en tu servidor, así que lo referencias por su URL externa.

---

## Aclaración: trabajadores reales vs. slots de presentación

El optimizador **siempre opera con trabajadores reales** (identificados por RUT). Es la única manera de respetar las restricciones individuales: vacaciones, días prohibidos, turnos prohibidos. Sin esta información, el ILP no puede generar un horario legalmente válido.

Los "slots" (`worker_slot: 1..N`) son únicamente un índice de presentación:

- El frontend puede mostrar "Trabajador 1, Trabajador 2..." en vistas donde el jefe de sucursal no debe ver nombres individuales (por ejemplo, antes de confirmar la propuesta).
- El `worker_rut` siempre se almacena junto al slot en la colección `proposals.asignaciones`.
- El jefe puede reasignar manualmente dentro del calendario; eso actualiza la colección `assignments`.

**Corolario para Spec 007 (export):** el backend genera el Excel a partir de `worker_rut`, no del slot. El RUT se formatea sin puntos y sin dígito verificador según el formato requerido.

---

## Decisiones de diseño clave y su justificación

| Decisión                                   | Justificación                                                                  |
|--------------------------------------------|--------------------------------------------------------------------------------|
| Backend stateless                          | Simplicidad, escalabilidad, facilidad de testing                               |
| Optimización en Python, no JS              | OR-Tools es muy superior a cualquier solver JS; Python es el estándar          |
| Excel parsing en frontend (SheetJS)        | Solo para el upload de dotación: feedback instantáneo al admin, sin round-trip |
| Export Excel en backend (openpyxl)         | El formato exacto (RUT sin DV, celdas combinadas, colores) es complejo; el backend es la fuente de verdad y evita divergencia de lógica |
| Optimizer usa trabajadores reales (con RUT)| Es la única forma de respetar restricciones individuales (vacaciones, días prohibidos, turnos prohibidos); los "slots" son solo un índice de presentación |
| `worker_slot` en respuesta del optimizer   | Permite mostrar "Trabajador 1..N" en vistas donde el jefe no debe ver nombres; el `worker_rut` siempre viaja junto para persistencia |
| ILP + Greedy comparables                   | Permite validar que ILP da buenos resultados y tener fallback rápido           |
| Propuestas guardadas en DB                 | Historial auditable; jefe puede elegir sin recalcular                          |
| Export: advertir, no bloquear (salvo crítico) | Bloquear por violaciones menores frustra al admin; solo se bloquea si hay días con cobertura = 0 |
| Validador duplicado (frontend ligero + backend autoritativo) | Frontend da feedback UX instantáneo; `/validate` es la fuente de verdad antes de guardar o exportar |
| Spec-Kit                                   | Documentación viva, facilita que Claude Code implemente sin perderse           |
