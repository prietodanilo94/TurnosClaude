# F8 — Registro de rollback (2026-07-01)

## Qué se hizo

Se revirtió en `main` todo el código de las "mejoras del consejo" (seguridad,
deduplicación, tests, páginas nuevas) que había sido mergeado y desplegado a
producción (pompeyo) el 2026-06-26. La spec F8-hardening quedó identificando
brechas de seguridad reales en ese código (ownership gaps en rutas de
exportación, `tokenVersion` no aplicado en runtime, etc.) — se decidió volver
al estado anterior mientras se trabaja en otra prioridad, en vez de dejar esas
brechas expuestas en producción.

## Por qué

- El council review (ver `spec.md`) encontró brechas de acceso cruzado
  explotables por cualquier supervisor autenticado (descarga de RUTs de
  sucursales ajenas, cambio de categoría de equipos ajenos, etc.).
- El usuario quería desarrollar algo distinto antes de cerrar esas brechas y
  prefirió no dejar el código nuevo (con huecos conocidos) corriendo en
  producción mientras tanto.

## Cómo se hizo

Se usó `git revert -m 1`, no `git reset --hard` ni force-push — el historial
completo se preserva y nada se pierde.

```bash
git revert -m 1 f888dca --no-edit   # revierte el merge del consejo
git checkout f888dca -- v4/specs/F7-produccion-final v4/specs/F8-hardening
git commit -m "v4/docs: preservar specs F7/F8 en main tras rollback de codigo"
git push origin main                 # dispara deploy automatico a pompeyo
```

Antes del revert se respaldó la base de pompeyo:
`/opt/shift-optimizer/backups/v4/v4-pre-rollback-20260701-123011.db`.

**La base de datos no se vio afectada.** `/data` vive en el volumen Docker
`v4_data`, separado de la imagen — un rollback de código nunca toca los datos.
La columna `tokenVersion` (agregada al schema por las mejoras del consejo)
sigue existiendo en la tabla `Supervisor`; el revert de git no revierte el
schema de la base. No causa ningún problema: el código anterior simplemente
no la usa.

## Verificación post-deploy

- Contenedor `v4-frontend-1` en pompeyo recreado el 2026-07-01 16:34 UTC
  (después del push del revert).
- `/admin/datos` (página agregada por el consejo) confirmado ausente del
  build compilado (`.next/server/app/admin/datos` no existe).
- `/login` responde 200 — app funcionando con normalidad.

## Estado de cada referencia después del rollback

| Referencia | Estado | Contiene |
|---|---|---|
| `main` (HEAD `44262b1`) | Desplegado en pompeyo | Código pre-consejo + specs F7/F8 (solo documentación) |
| `worktree-council-improvements` (branch) | Intacto, sin tocar | Todo el código de seguridad/dedup/tests del consejo — commits `089d7d2`...`4571075` |
| tag `v4-pre-council-2026-06-25` | Sin cambios | Snapshot justo antes de que empezara el trabajo del consejo |
| tag `v4-stable-20260505` | Sin cambios | Snapshot más antiguo, pre-sesión mayo |
| commit `f888dca` | Sigue existiendo en el historial de `main` | El merge original — recuperable en cualquier momento |
| commit `ed5f074` | En `main` | El commit que revierte `f888dca` |

Nada se borró. `git log --all` sigue mostrando todos los commits; el revert
solo cambia qué contenido está activo en la punta de `main`.

## Cómo retomar el trabajo pendiente más adelante

**Opción A — Deshacer el revert (recomendado si no hubo cambios nuevos en el medio):**
```bash
git revert ed5f074 --no-edit   # revierte el revert = vuelve a traer el código del consejo
git push origin main
```

**Opción B — Volver a mergear el branch (si se siguió trabajando en él):**
```bash
git checkout worktree-council-improvements
# ... aplicar los fixes de v4/specs/F8-hardening/tasks.md ...
git checkout main
git merge worktree-council-improvements --no-ff
git push origin main
```

Antes de re-desplegar, resolver como mínimo la **Fase 1** de
`v4/specs/F8-hardening/tasks.md` (ownership en rutas de exportación) — es la
brecha más seria que motivó este rollback.

Después de cualquiera de las dos opciones, correr en pompeyo:
```bash
docker exec v4-frontend-1 node ./node_modules/prisma/build/index.js db push
```
(no debería hacer nada, ya que `tokenVersion` sigue en el schema de la DB,
pero confirma que el schema del código coincide con el de la base).
