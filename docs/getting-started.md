# Getting Started

Guía breve para empezar. Para el paso a paso detallado hacia Claude Code, ver [`claude-code-guide.md`](./claude-code-guide.md).

## Requisitos

- Node.js 20+
- Python 3.11+ (opcional si vas a correr el backend fuera de Docker)
- Docker Desktop
- Git
- Cuenta de Anthropic (para Claude Code)
- Appwrite corriendo en tu servidor (ya lo tienes)

## Pasos

1. **Coloca este paquete** en `~/Proyectos/shift-optimizer/` (o donde prefieras).
2. **Inicializa Git**:
   ```bash
   cd ~/Proyectos/shift-optimizer
   git init && git add . && git commit -m "Initial specs and docs"
   ```
3. **Instala Claude Code**:
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```
4. **Lee los documentos en este orden**:
   - `README.md` (raíz)
   - `docs/claude-code-guide.md` ← **IMPORTANTE**
   - `docs/architecture.md`
   - `docs/math-formulation.md`
   - `specs/001-data-model/spec.md` en adelante
5. **Abre Claude Code en la raíz del proyecto** y sigue el flujo de trabajo descrito en `claude-code-guide.md`.

## Qué hacer cuando llegue la Entrega 2

En la Entrega 2 te daré el backend Python + Docker Compose. El flujo será:

1. Descomprimes sobre la misma carpeta (nada se sobrescribe; solo se agregan archivos).
2. `git add . && git commit -m "feat: backend base y docker compose"`
3. `docker compose up --build` y verificas que el endpoint `/health` responde.
4. Abres Claude Code y le dices: "Revisa lo nuevo. Queremos completar la spec 003. ¿Qué falta?"
