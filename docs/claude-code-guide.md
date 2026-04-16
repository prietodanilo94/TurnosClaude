# Guía paso a paso: De este paquete de specs a Claude Code

Esta guía está escrita asumiendo que **nunca has usado Claude Code**. Si ya lo usaste, puedes saltarte las secciones marcadas como `(principiante)`.

El objetivo es que al final tengas:

1. El proyecto clonado/creado en tu computador.
2. Claude Code instalado y configurado.
3. Un primer ejemplo funcional corriendo (aunque sea un "Hola Mundo").
4. Un flujo claro de cómo darle tareas a Claude Code usando las specs de este repo.

---

## Parte 1 — Requisitos previos

### 1.1. Herramientas que necesitas instalar

| Herramienta        | Para qué                             | Cómo verificar                |
|--------------------|--------------------------------------|-------------------------------|
| **Node.js 20+**    | Ejecutar Claude Code y Next.js       | `node --version`              |
| **npm**            | Instalar paquetes JS                  | `npm --version`               |
| **Git**            | Control de versiones                 | `git --version`               |
| **Docker Desktop** | Correr Appwrite + FastAPI local      | `docker --version`            |
| **Python 3.11+**   | Correr backend optimizador (opcional, se puede solo en Docker) | `python3 --version` |
| **VSCode o Cursor**| Editor de código                     | (abrir el programa)           |

Si te falta alguna, instálala antes de seguir. En macOS con Homebrew:

```bash
brew install node git python@3.11
brew install --cask docker visual-studio-code
```

En Windows: descarga los instaladores oficiales de cada una.

### 1.2. Cuenta de Anthropic con acceso a Claude

Claude Code requiere una cuenta de Anthropic. Ya tienes una (estás hablando conmigo). El mismo login sirve.

---

## Parte 2 — Instalar Claude Code `(principiante)`

### 2.1. Instalación

Abre tu terminal y ejecuta:

```bash
npm install -g @anthropic-ai/claude-code
```

Esto instala el comando `claude` globalmente.

### 2.2. Primer login

```bash
claude
```

La primera vez te pedirá autenticarte. Abrirá el navegador, inicias sesión con tu cuenta de Anthropic, y listo.

### 2.3. Verificar que funciona

Estando en tu terminal, en cualquier carpeta:

```bash
claude
```

Se abre una sesión interactiva. Escribe:

```
¿Qué eres?
```

Si responde, todo bien. Sal con `/exit` o `Ctrl+C`.

> **Nota**: Claude Code también tiene una extensión para VSCode/Cursor que te permite invocarlo desde dentro del editor. Recomendable pero opcional.

---

## Parte 3 — Preparar el proyecto en tu computador

### 3.1. Crear la carpeta del proyecto

```bash
mkdir -p ~/Proyectos/shift-optimizer
cd ~/Proyectos/shift-optimizer
```

(En Windows la ruta será algo como `C:\Users\TU_USUARIO\Proyectos\shift-optimizer`.)

### 3.2. Descomprimir el paquete que te entregué

El ZIP que descargaste del chat contiene la estructura `shift-optimizer/` con `specs/`, `docs/`, `README.md`, etc. Cópialo dentro de `~/Proyectos/shift-optimizer/` de forma que te quede:

```
~/Proyectos/shift-optimizer/
├── README.md
├── specs/
├── docs/
└── .gitignore   (si no existe, créalo en el paso 3.4)
```

### 3.3. Inicializar Git

```bash
cd ~/Proyectos/shift-optimizer
git init
git add .
git commit -m "Initial commit: specs y documentación"
```

### 3.4. Crear un `.gitignore` básico

Crea un archivo llamado `.gitignore` en la raíz con este contenido:

```
# Node
node_modules/
.next/
out/
dist/
*.log

# Python
__pycache__/
*.pyc
.venv/
venv/
*.egg-info/

# Env
.env
.env.local
.env.*.local

# OS
.DS_Store
Thumbs.db

# Editor
.vscode/
.idea/

# Appwrite local
appwrite/data/

# Excel generados / temporales
*.xlsx.bak
/tmp/
```

Commitéalo:

```bash
git add .gitignore
git commit -m "Add .gitignore"
```

### 3.5. (Recomendado) Crear repositorio remoto

Crea un repo privado en GitHub/GitLab y conéctalo:

```bash
git remote add origin git@github.com:TU_USUARIO/shift-optimizer.git
git branch -M main
git push -u origin main
```

Esto te da respaldo y posibilita ver el historial de cambios cuando Claude Code trabaje.

---

## Parte 4 — Primera sesión con Claude Code sobre este proyecto

### 4.1. Abrir Claude Code dentro del proyecto

```bash
cd ~/Proyectos/shift-optimizer
claude
```

**Importante**: Claude Code lee archivos y escribe archivos en la carpeta donde lo abres. Siempre ábrelo desde la raíz del proyecto.

### 4.2. Primer comando: que Claude lea las specs

Una vez dentro de la sesión de Claude Code, escribe:

```
Lee el archivo README.md y luego recorre la carpeta specs/ para
entender el proyecto. Cuando termines, hazme un resumen de qué
entendiste y qué preguntas tienes antes de empezar a implementar.
```

Claude Code leerá los archivos uno por uno. Espera su resumen. Si algo falta o malentendió, corrígelo antes de seguir.

### 4.3. Segundo comando: crear el archivo `CLAUDE.md`

`CLAUDE.md` es un archivo especial que Claude Code lee automáticamente al iniciar en cualquier proyecto. Sirve para dejarle instrucciones permanentes. Pídele:

```
Crea un archivo CLAUDE.md en la raíz del proyecto. Debe contener:

1. Un resumen ejecutivo del proyecto (máximo 10 líneas).
2. Las convenciones del repo (idioma del código en inglés, docs en
   español, semana lunes-domingo, RUT sin puntos en export).
3. El stack técnico.
4. Una instrucción clara: "Antes de implementar cualquier feature,
   lee primero specs/NNN-feature/spec.md y specs/NNN-feature/tasks.md.
   Propone un plan de implementación y espera aprobación antes de
   escribir código."
5. Comandos útiles del proyecto (docker compose up, npm run dev, etc.)
   dejando placeholders para los que aún no existan.

No implementes nada más. Solo crea CLAUDE.md.
```

Revísalo, ajústalo si quieres, y commitéalo:

```bash
git add CLAUDE.md
git commit -m "Add CLAUDE.md with project conventions"
```

---

## Parte 5 — Flujo de trabajo recomendado con Claude Code

Este es el flujo que te recomiendo seguir para cada feature del proyecto. Lo repites de la spec 001 a la 010.

### 5.1. El flujo en 6 pasos

```
┌─────────────────────────────────────────────────────────────┐
│  1. Abres Claude Code desde la raíz del proyecto            │
│  2. Le pides leer specs/NNN-feature/                        │
│  3. Le pides un PLAN de implementación (sin código todavía) │
│  4. Revisas el plan, lo ajustas, apruebas                   │
│  5. Le pides implementar tarea por tarea (del tasks.md)     │
│  6. Commit después de cada tarea completada                 │
└─────────────────────────────────────────────────────────────┘
```

### 5.2. Ejemplo concreto — Implementar la Spec 001 (Data Model)

**Paso 1**: Desde `~/Proyectos/shift-optimizer/`:

```bash
claude
```

**Paso 2**: En la sesión, escribe:

```
Lee specs/001-data-model/spec.md y specs/001-data-model/tasks.md.
No escribas código todavía.
```

**Paso 3**: Luego pídele el plan:

```
Propón un plan de implementación detallado para la spec 001. Incluye:
- Qué archivos vas a crear.
- En qué orden.
- Qué comandos de Appwrite CLI (si aplica) vas a usar.
- Qué tests unitarios agregarás.

Espera mi aprobación antes de empezar.
```

**Paso 4**: Lees el plan. Si tienes dudas o algo no te gusta, discútelo en chat. Cuando estés conforme:

```
Aprobado. Ejecuta la tarea 1 de tasks.md. Cuando termines, muéstrame
el diff y espera que yo haga commit antes de continuar con la tarea 2.
```

**Paso 5**: Revisas el diff. Si está bien:

```bash
# En otra terminal (o sal de Claude Code con Ctrl+Z temporalmente)
git diff
git add .
git commit -m "feat(data-model): implementa colección workers (task 1/5)"
```

**Paso 6**: Vuelves a Claude Code y:

```
Commit hecho. Procede con la tarea 2.
```

Y así sucesivamente.

### 5.3. Por qué este flujo funciona

- **Commits pequeños** = fácil revertir si algo sale mal.
- **Plan antes de código** = Claude Code no se dispersa.
- **Spec como fuente de verdad** = si cambias de opinión, cambias la spec y regeneras.
- **Tú apruebas cada paso** = no se te va de las manos.

### 5.4. Atajos útiles de Claude Code

Dentro de la sesión, puedes usar comandos:

| Comando          | Qué hace                                             |
|------------------|------------------------------------------------------|
| `/clear`         | Limpia el contexto (empieza una conversación nueva)  |
| `/compact`       | Comprime el historial para ahorrar tokens            |
| `/help`          | Muestra la ayuda                                     |
| `/exit`          | Cierra la sesión                                     |
| `!<comando>`     | Ejecuta un comando de shell (ej: `!git status`)      |

### 5.5. Cuándo volver a este chat (conmigo)

Vuelve a este chat cuando:

- Quieras cambiar **reglas de negocio** (ej: "ahora el horario peak empieza a las 16:00").
- Quieras agregar una **feature nueva** (una nueva spec).
- Tengas una **duda de diseño** o arquitectura.
- El optimizador esté dando resultados raros y necesites repensar la **formulación matemática**.

Usa Claude Code para:

- **Escribir código** siguiendo las specs ya definidas.
- **Refactorizar**, correr tests, agregar validaciones.
- **Debuggear** errores concretos.
- **Leer/analizar** archivos de tu proyecto.

---

## Parte 6 — Orden recomendado de implementación

Sigue este orden. Cada fila es una sesión de trabajo (no necesariamente un día).

| Orden | Spec                        | Qué entrega                                   | Dependencias       |
|-------|-----------------------------|-----------------------------------------------|--------------------|
| 1     | 008-holidays                | Tabla de feriados irrenunciables              | —                  |
| 2     | 001-data-model              | Colecciones Appwrite + tipos TS + modelos Py  | —                  |
| 3     | 005-auth-permissions        | Login, roles, middleware de permisos          | 001                |
| 4     | 002-excel-ingestion         | Upload Excel + parseo + sincronización        | 001                |
| 5     | 003-optimizer (backend)     | FastAPI + ILP OR-Tools + greedy + endpoints   | 001, 008           |
| 6     | 004-calendar-ui             | Grilla mensual + drag & drop + validaciones   | 003                |
| 7     | 010-multiple-proposals      | Guardado de N propuestas + selección          | 003, 004           |
| 8     | 006-exceptions              | UI y lógica de excepciones por trabajador     | 001, 003           |
| 9     | 009-recalculate-partial     | Recálculo por rango de fechas + dotación      | 003, 004           |
| 10    | 007-export-excel            | Generación del Excel final                    | 004                |

---

## Parte 7 — Cosas que te van a pasar y cómo manejarlas

### 7.1. "Claude Code hizo algo que no pedí"

- Corta con `Ctrl+C`.
- Revisa con `git status` y `git diff` qué archivos tocó.
- Si algo está mal: `git checkout -- <archivo>` o `git reset --hard HEAD`.
- Vuelve a empezar con instrucciones más precisas y limitadas ("solo toca el archivo X").

### 7.2. "Se está pasando de tokens / muy lento"

- Usa `/compact` para comprimir el historial de la sesión.
- O usa `/clear` y vuelve a darle contexto mínimo leyendo solo la spec que toca.

### 7.3. "Quiero que pruebe lo que hizo"

Dile: "Corre los tests y muéstrame el resultado. Si falla algo, arréglalo antes de seguir."

### 7.4. "Está editando archivos que no debería"

Agrega a `CLAUDE.md` una sección de "archivos intocables" con lista explícita.

---

## Parte 8 — Siguientes entregas que vas a recibir de mí

Después de este paquete, las próximas entregas que te daré desde este chat son:

| Entrega   | Contenido                                                         |
|-----------|-------------------------------------------------------------------|
| **2**     | Dockerfile y docker-compose.yml listos + código base del backend FastAPI |
| **3**     | Scaffolding del frontend Next.js (login, upload, selector sucursal)      |
| **4**     | Componente de calendario con drag & drop y contador de horas             |
| **5**     | Export Excel + excepciones + recálculo parcial                           |

Cada una vendrá como ZIP con los archivos listos para copiar al proyecto. Para cada entrega, el flujo será:

1. Descomprimir dentro de `~/Proyectos/shift-optimizer/`.
2. Hacer commit del estado nuevo: `git add . && git commit -m "feat: entrega N de specs"`.
3. Abrir Claude Code y decirle: "Revisa los nuevos archivos agregados y dime si necesitas aclaraciones antes de implementar."

---

## FAQ

**¿Puedo usar Cursor o Windsurf en vez de Claude Code?**
Sí, funcionan muy bien con este mismo flujo basado en specs. El archivo `CLAUDE.md` lo puedes renombrar a `.cursorrules` o dejarlo como está — Cursor también lo leerá.

**¿Necesito pagar algo extra por Claude Code?**
Claude Code consume del mismo plan de tu cuenta de Anthropic. Consulta los límites vigentes en tu plan.

**¿Y si me trabo en un paso?**
Vuelves a este chat, me cuentas exactamente en qué estás, y te desatasco. No te sientas mal de consultar cosas "obvias": la curva de aprendizaje es real.

**¿El proyecto entero lo hago yo con Claude Code o tú me lo terminas?**
El diseño y los specs los hacemos acá. El código concreto (frontend, backend, tests) lo hace Claude Code guiado por las specs. Yo te doy scaffoldings iniciales en cada entrega para que no partas de cero, pero la iteración continua es mejor con Claude Code en tu máquina.
