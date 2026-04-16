# Primeros prompts para Claude Code

Tras abrir Claude Code en la raíz del proyecto (`~/Proyectos/shift-optimizer/`), copia y pega estos prompts en orden para empezar.

---

## Prompt 1 — Contexto inicial

```
Este es un proyecto nuevo. Acabo de agregar las specs iniciales. Por favor:

1. Lee CLAUDE.md completo.
2. Lee README.md.
3. Recorre la carpeta docs/ y lee cada archivo.
4. Recorre la carpeta specs/ y lee al menos el spec.md de cada una de las 10
   especificaciones (no leas todavía plan.md y tasks.md).

Cuando termines, hazme un resumen ejecutivo de máximo 15 líneas de:
- Qué entendiste del proyecto.
- Qué convenciones aplicarán.
- Cuál es el flujo de trabajo que seguiremos.
- Qué dudas tienes antes de empezar.

No implementes nada todavía.
```

Revisa el resumen. Si hay malentendidos, corrígelos en el chat antes de seguir.

---

## Prompt 2 — Primera feature: Spec 008 (Feriados)

Por qué empezamos con 008: es pequeña, autocontenida, no depende de nada, y nos obliga a dejar la estructura base del proyecto lista (package.json, Appwrite client, etc.).

```
Vamos a implementar la spec 008 (feriados). Antes de escribir código:

1. Lee specs/008-holidays/spec.md, plan.md y tasks.md completos.
2. Dado que es la primera feature, también necesitamos dejar listo:
   - La estructura básica del monorepo (frontend/ y backend/ pueden quedarse
     vacíos por ahora; scripts/ lo vamos a usar).
   - package.json raíz con tsx, node-appwrite, dotenv y typescript.
   - .env.example con las variables de Appwrite.
   - Una conexión mínima a Appwrite que verifiquemos funciona (con un
     script scripts/ping-appwrite.ts).

3. Propón un PLAN DE IMPLEMENTACIÓN detallado con:
   - Lista de archivos a crear, en orden.
   - Qué va a contener cada uno (sin escribir el código todavía).
   - Qué variables de entorno necesito configurar en .env antes de correr.
   - Primera verificación que haremos (ej: scripts/ping-appwrite.ts imprime ok).

Espera mi aprobación antes de implementar.
```

---

## Prompt 3 — Ejecución iterativa

Una vez aprobado el plan:

```
Plan aprobado. Ejecuta la primera tarea. Cuando termines:
- Muéstrame qué archivos creaste/modificaste (diff corto).
- Dime cómo puedo verificar que funciona.
- NO pases a la siguiente tarea hasta que yo te diga "ok, commit hecho, sigue".
```

---

## Prompt 4 — Después del commit, siguiente tarea

```
Commit hecho. Procede con la siguiente tarea.
```

Repítelo hasta terminar la spec.

---

## Prompts útiles para cualquier momento

### Cuando Claude Code se desvía

```
Detente. Revisa el último commit con git log -1 y dime qué se hizo.
Estoy confundido sobre por qué tocaste X archivo.
```

### Para validar el estado

```
Haz git status y git diff. Muéstrame qué cambios tienes sin commitear.
```

### Para correr tests

```
Corre los tests relevantes a lo que acabas de hacer. Si algo falla,
arréglalo antes de que hagamos commit.
```

### Para cambiar de spec

```
Ya terminamos la spec NNN. Ahora vamos con la MMM. Repite el flujo:
leer spec.md, plan.md, tasks.md, proponer plan, esperar aprobación.
```

### Para actualizar CLAUDE.md

```
Agrega a CLAUDE.md en la sección "Comandos útiles" los comandos reales
que implementamos en esta spec. No modifiques otras secciones.
```

---

## Regla de oro

**Si Claude Code propone algo que no está en las specs y no lo pediste, detenlo.** La consistencia del proyecto depende de que el código refleje las specs, no al revés. Si hay una mejora que quieres incorporar, primero actualiza la spec correspondiente (conmigo en este chat o directamente), luego pídele a Claude Code que implemente.
