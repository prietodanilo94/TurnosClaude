# Shift Optimizer — Optimizador de Turnos de Ejecutivos de Venta

Webapp para generar turnos mensuales de ejecutivos de venta de forma matemáticamente óptima y justificable, con edición manual asistida y exportación a Excel.

---

## Visión general

El sistema resuelve el problema de asignar turnos semanales/mensuales a los asesores de venta de cada sucursal, respetando:

- Las franjas horarias de apertura/cierre según el tipo de sucursal.
- La legislación laboral chilena (42 horas semanales, 6 días máximo, descansos).
- La cobertura mínima de atención (siempre ≥ 1 persona durante la franja).
- Las preferencias del negocio (más dotación en fines de semana y horarios peak).
- Restricciones individuales por trabajador (días prohibidos, vacaciones, etc.).

La optimización se ofrece en dos modos comparables lado a lado:

- **ILP (Programación Lineal Entera)**: óptimo matemático global, vía Google OR-Tools.
- **Greedy (Heurística)**: rápida, no óptima, útil para comparar y como fallback.

Una vez generada la propuesta, el admin (o el jefe de sucursal) puede ajustar el calendario con drag & drop, validar en tiempo real que se cumplan las restricciones, y exportar el resultado final a Excel con el formato requerido por los sistemas downstream.

---

## Tipos de sucursal y franjas horarias

| Tipo          | Lunes-Viernes      | Sábado            | Domingo           |
|---------------|--------------------|-------------------|-------------------|
| Standalone    | 09:00–19:00        | 10:00–14:00       | Cerrado           |
| AutoPark      | 09:00–19:00        | 09:00–19:00       | Cerrado           |
| Movicenter    | 10:00–20:00        | 10:00–20:00       | 10:00–20:00       |
| TQAOEV        | 10:00–20:00        | 10:00–20:00       | 11:00–20:00       |
| SUR           | L-J 10:30–20:30 / V 10:30–21:00 | 10:30–20:30 | 11:00–20:00 |

## Turnos disponibles

**Principales:**
- 10:00–20:00 (10 h)
- 11:00–20:00 (9 h)
- 10:00–19:00 (9 h)
- 10:30–20:30 (10 h)
- 10:30–21:00 (10.5 h)
- 09:00–19:00 (10 h)
- 10:00–14:00 (4 h)

**Adicionales:**
- 13:00–20:00 (7 h)
- 10:00–17:00 (7 h)
- 12:00–20:00 (8 h)

> A los turnos de ≥ 8 h se les descuenta **1 hora de colación** al computar las 42 h semanales. Los turnos de 4 h y 7 h **no** descuentan colación.

---

## Arquitectura

```
┌─────────────────────┐          ┌──────────────────────┐
│  Next.js (frontend) │ ────────▶│   Appwrite (auth,    │
│  React + TS         │          │   DB, storage)       │
│  Tailwind + shadcn  │          │                      │
│  FullCalendar       │          └──────────────────────┘
└──────────┬──────────┘                     ▲
           │                                │
           │  /optimize (REST/JSON)         │
           ▼                                │
┌─────────────────────┐                     │
│  FastAPI (backend)  │─────────────────────┘
│  Python + OR-Tools  │
│  + heurística       │
└─────────────────────┘
```

Todo corre en Docker Compose sobre tu servidor.

---

## Stack técnico

| Capa                      | Tecnología                               |
|---------------------------|-------------------------------------------|
| Frontend                  | Next.js 14+, React, TypeScript            |
| Estilos                   | Tailwind CSS + shadcn/ui                  |
| Calendario                | FullCalendar (mensual + drag & drop)      |
| Parseo Excel (upload)     | SheetJS (`xlsx`)                          |
| Auth / DB / Storage       | Appwrite (self-hosted en tu servidor)     |
| Backend optimizador       | FastAPI (Python 3.11+)                    |
| Motor ILP                 | Google OR-Tools (`ortools.sat`)           |
| Export Excel (download)   | `openpyxl`                                |
| Orquestación              | Docker Compose                            |

---

## Roles y permisos

- **Admin**: acceso total. Sube Excel, crea jefes de sucursal, configura sucursales, genera optimizaciones, edita, aprueba y exporta.
- **Jefe de sucursal**: ve solo las sucursales asignadas. Puede elegir entre propuestas generadas por el admin y asignar los slots genéricos (Trabajador 1, 2, …) a personas reales de su dotación. No puede modificar la estructura del turnero ni recalcular.

---

## Estructura del repositorio

```
shift-optimizer/
├── README.md                    ← este archivo
├── specs/                       ← especificaciones Spec-Kit (1 por feature)
│   ├── 001-data-model/
│   ├── 002-excel-ingestion/
│   ├── 003-optimizer/
│   ├── 004-calendar-ui/
│   ├── 005-auth-permissions/
│   ├── 006-exceptions/
│   ├── 007-export-excel/
│   ├── 008-holidays/
│   ├── 009-recalculate-partial/
│   └── 010-multiple-proposals/
├── docs/                        ← documentación de soporte
│   ├── getting-started.md
│   ├── claude-code-guide.md     ← GUÍA PASO A PASO PARA TRANSICIONAR A CLAUDE CODE
│   ├── architecture.md
│   ├── appwrite-setup.md
│   └── math-formulation.md      ← formulación matemática completa del ILP
├── backend/                     ← (a generar con Claude Code)
├── frontend/                    ← (a generar con Claude Code)
└── docker-compose.yml           ← (a generar con Claude Code)
```

---

## ¿Por dónde empezar?

1. Lee esta introducción.
2. Lee **`docs/claude-code-guide.md`** — es la guía paso a paso para pasar de este paquete de specs a un proyecto corriendo en tu computador con Claude Code.
3. Lee `docs/architecture.md` y `docs/math-formulation.md` para entender el diseño técnico.
4. Revisa las specs en orden: 001 → 010.
5. Una vez en Claude Code, implementa feature por feature siguiendo cada `spec.md` y `tasks.md`.

---

## Convenciones

- **Código**: inglés (`worker`, `branch`, `shift`…).
- **Documentación y UI**: español.
- **Semana laboral**: lunes a domingo (convención chilena).
- **IDs de sucursal**: el código numérico de la columna "Área" del Excel (ej: `1200`, `350`, `330`).
- **RUT**: siempre sin puntos ni dígito verificador en la exportación final. Internamente se guarda en formato `XXXXXXXX-X`.
