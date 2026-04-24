# Playbook Maestro de Creación de Web Apps

Este documento define el marco de trabajo para construir nuevas web apps de forma clara, auditable y eficiente en tiempo, complejidad operativa y consumo de tokens.

Su objetivo no es describir una app específica. Su objetivo es definir el sistema que usaremos antes de crear una nueva app, por ejemplo una futura `v3`.

---

## 1. Propósito

Este playbook existe para evitar estos problemas:

- partir construyendo sin haber cerrado la idea
- mezclar producto, arquitectura y ejecución en una sola conversación
- repartir demasiada lógica entre frontend, backend, auth y terceros
- dejar deploys no deterministas
- gastar tiempo y tokens debuggeando cosas que debieron resolverse antes de escribir código

Resultado esperado:

- una idea bien definida
- documentación técnica suficiente antes de construir
- specs ejecutables una por una
- un sistema de deploy y validación repetible

---

## 2. Principios

### 2.1. Una sola fuente de verdad por tema

Cada dimensión importante debe tener una sola fuente de verdad:

- producto: brief y specs
- arquitectura: documento técnico y ADRs
- modelo de datos: schema y migraciones
- auth: un solo flujo oficial
- deploy: una sola receta reproducible
- estado del proyecto: changelog operativo y documentación viva

### 2.2. Construir después de decidir

No se empieza por código.

Orden obligatorio:

1. idea
2. definición funcional
3. diseño técnico
4. plan de implementación
5. construcción

### 2.3. Server-side para lo crítico

Todo flujo sensible debe vivir del lado servidor o backend:

- login
- autorización
- operaciones con permisos
- exportaciones
- integraciones externas
- transformaciones de datos críticas

El navegador no debe ser el lugar donde se resuelve la lógica delicada.

### 2.4. Deploy determinista

Si el mismo commit no produce el mismo resultado, el sistema está incompleto.

Todo proyecto nuevo debe poder responder claramente:

- cómo se construye
- cómo se despliega
- cómo se valida
- cómo se revierte

### 2.5. Menos moving parts

La velocidad inicial engaña. Cada capa extra cobra después en debugging.

Preferencia:

- menos servicios
- menos caminos alternativos
- menos orígenes de sesión
- menos lógica duplicada

### 2.6. Documentación suficiente, no ornamental

La documentación debe ayudar a construir y operar, no adornar.

Debe responder:

- qué es
- cómo funciona
- dónde está cada cosa
- cómo se prueba
- cómo se despliega
- cómo se repara

---

## 3. Fases del proceso

Toda nueva web app se trabaja en tres fases mayores.

### Fase 1. Desarrollo de idea

Objetivo:

- convertir una intuición o necesidad en un problema bien definido

Salida mínima obligatoria:

- nombre tentativo del proyecto
- problema que resuelve
- usuario principal
- usuarios secundarios
- flujo principal de valor
- restricciones reales
- no-objetivos
- riesgos tempranos
- criterio de éxito

### Fase 2. Documentación técnica pre-construcción

Objetivo:

- decidir la arquitectura antes de escribir código

Salida mínima obligatoria:

- arquitectura general
- stack elegido y razones
- modelo de datos inicial
- auth y permisos
- integración con terceros
- estructura de repositorio
- estrategia de testing
- estrategia de deploy
- estrategia de observabilidad
- roadmap de specs

### Fase 3. Construcción

Objetivo:

- implementar una spec a la vez sin romper el sistema

Salida mínima obligatoria por spec:

- código
- tests
- validación real
- documentación actualizada
- estado operativo actualizado

---

## 4. Artefactos obligatorios por fase

### 4.1. Fase 1: Desarrollo de idea

Artefactos:

- `project-brief.md`
- `problem-statement.md`
- `scope.md`
- `success-metrics.md`
- `risk-register.md`

Contenido mínimo del brief:

- resumen ejecutivo
- problema
- oportunidad
- quién lo usará
- qué no hará
- por qué ahora

### 4.2. Fase 2: Pre-construcción técnica

Artefactos:

- `architecture.md`
- `data-model.md`
- `auth-and-permissions.md`
- `api-contracts.md`
- `deployment.md`
- `testing-strategy.md`
- `adr/`
- `spec-index.md`

### 4.3. Fase 3: Construcción

Artefactos:

- `specs/NNN-feature/spec.md`
- `specs/NNN-feature/tasks.md`
- `specs/NNN-feature/notes.md` opcional
- pruebas automatizadas
- smoke tests
- changelog operativo

---

## 5. Metodología Spec-Kit

La app no se construye como una lista informal de ideas. Se construye como una serie de specs pequeñas, ordenadas y verificables.

### 5.1. Qué es una spec

Una spec es una unidad de construcción autocontenida. No es solo una idea; es una pieza ejecutable del proyecto.

Cada spec debe poder responder:

- qué problema resuelve
- qué cambia
- qué archivos toca
- cómo se valida
- cuándo está realmente terminada

### 5.2. Estructura mínima de cada spec

`spec.md`

- contexto
- objetivo
- user story
- alcance
- fuera de alcance
- criterios de aceptación
- riesgos
- dependencias

`tasks.md`

- tareas concretas
- orden de implementación
- archivos esperados
- tests requeridos
- validación manual si aplica

### 5.3. Reglas del Spec-Kit

- una spec a la vez
- no implementar fuera de spec sin dejarlo escrito
- no mezclar refactor grande con feature nueva si no está planificado
- no marcar una spec como terminada si no existe validación real
- si una spec obliga a cambiar otra, se documenta

### 5.4. Orden recomendado de una spec

1. leer contexto
2. validar dependencias
3. hacer plan corto
4. implementar
5. correr tests
6. hacer smoke real si corresponde
7. documentar estado
8. recién entonces cerrar

---

## 6. Arquitectura recomendada para futuras apps

No toda app necesita el mismo stack. Pero como base para minimizar debugging, esta es la recomendación por defecto.

### 6.1. Opción recomendada por defecto

- frontend: Next.js
- backend: FastAPI o NestJS
- base de datos: Postgres
- auth: server-side
- storage: S3 compatible o equivalente
- background jobs: cola simple si realmente hace falta
- nginx o proxy claro delante del sistema

### 6.2. Cuándo usar un BaaS tipo Appwrite

Sí usarlo si:

- quieres acelerar auth y CRUD simple
- el equipo es pequeño
- el producto todavía está validando hipótesis
- el modelo de permisos es relativamente estándar

No usarlo como centro de gravedad si:

- la lógica de negocio es compleja
- los flujos de auth son sensibles
- habrá exportaciones, integraciones y validaciones delicadas
- el costo de debugging operacional puede pegar fuerte

### 6.3. Regla práctica

Si una app tiene lógica compleja, preferir:

- Appwrite solo para auth/documentos simples
- backend propio para lo crítico

Si una app tiene mucha lógica de negocio y poco beneficio de BaaS, preferir:

- backend propio + Postgres + auth server-side

---

## 7. Reglas de diseño técnico pre-construcción

Antes de escribir código deben quedar resueltas estas decisiones.

### 7.1. Auth

Definir por escrito:

- quién inicia sesión
- dónde se crea la sesión
- cómo se persiste
- cómo se renueva
- cómo se invalida
- qué capa verifica permisos

Regla:

- no se permiten dos flujos de auth compitiendo entre sí

### 7.2. Datos

Definir por escrito:

- entidades principales
- relaciones
- restricciones
- campos obligatorios
- identificadores estables
- estrategia de migraciones

### 7.3. API

Definir por escrito:

- endpoints
- contratos
- errores esperables
- permisos por endpoint
- versionado si aplica

### 7.4. Deploy

Definir por escrito:

- cómo se construye la imagen
- qué variables necesita
- cómo se hace rollback
- cómo se hace smoke test
- cómo se compara local vs servidor

### 7.5. Observabilidad

Definir por escrito:

- logs mínimos
- health checks
- métricas mínimas
- errores importantes que deben verse fácil

---

## 8. Reglas de implementación

### 8.1. Empezar por verticales pequeñas

Mejor un flujo completo pequeño que cinco capas a medio terminar.

Orden sugerido:

1. auth
2. modelo de datos
3. CRUD base
4. flujo principal
5. exportaciones / integraciones
6. refinamiento

### 8.2. No distribuir responsabilidad sin necesidad

Evitar:

- frontend validando algo distinto que backend
- dos fuentes de verdad para permisos
- cálculos de negocio repartidos en tres capas

### 8.3. Feature flags y rollout

Si un cambio puede romper operación:

- activar por flag
- dejar camino de rollback
- validar primero en entorno controlado

### 8.4. Refactor con criterio

Refactor permitido si:

- reduce complejidad real
- evita duplicación importante
- no rompe el avance de la spec

No refactorizar por estética durante un cierre funcional delicado.

---

## 9. Reglas de testing

Cada nueva app debe tener tres niveles.

### 9.1. Unit tests

Para:

- lógica pura
- validadores
- transformaciones
- reglas de negocio pequeñas

### 9.2. Integration tests

Para:

- endpoints
- permisos
- persistencia
- flows críticos entre capas

### 9.3. Smoke tests

Para:

- verificar que el sistema desplegado responde de verdad

Regla:

- no declarar lista una spec crítica sin smoke real

---

## 10. Reglas de deploy

### 10.1. Antes de desplegar

- repo limpio
- commit creado
- push realizado
- documentación actualizada
- tests relevantes pasando

### 10.2. Despliegue

- pull limpio en servidor
- build reproducible
- restart controlado
- smoke inmediato

### 10.3. Después de desplegar

- verificar rutas críticas
- verificar auth
- verificar logs
- verificar que local, GitHub y servidor quedaron alineados

---

## 11. Checklist de inicio de una nueva app

Antes de escribir la primera línea de código:

- el problema está definido
- el usuario principal está claro
- el alcance inicial está cerrado
- los no-objetivos están escritos
- el stack está decidido
- auth está decidida
- modelo de datos inicial está decidido
- estrategia de deploy está escrita
- primera lista de specs está creada

Si falta cualquiera de esos puntos, todavía no toca construir.

---

## 12. Checklist de cierre por spec

Una spec se considera cerrada solo si:

- el objetivo está implementado
- los criterios de aceptación se cumplen
- los tests requeridos pasan
- existe validación manual si correspondía
- el estado operativo quedó documentado
- el deploy quedó alineado si era parte del alcance

---

## 13. Antipatrones que hacen gastar tokens

Estos son los principales enemigos de eficiencia.

### 13.1. Construir sin marco

Síntoma:

- las decisiones aparecen mientras ya se está implementando

Consecuencia:

- se reabre arquitectura muchas veces

### 13.2. Auth híbrida mal definida

Síntoma:

- parte del login vive en browser, parte en backend, parte en tercero

Consecuencia:

- debugging caro y ambiguo

### 13.3. Deploy no determinista

Síntoma:

- el mismo commit no produce siempre el mismo resultado

Consecuencia:

- tiempo perdido en cachés, imágenes y estados fantasma

### 13.4. Specs demasiado grandes

Síntoma:

- una spec cambia demasiadas capas a la vez

Consecuencia:

- cuesta validar y cuesta cerrar

### 13.5. Documentación desalineada

Síntoma:

- el código dice una cosa y la documentación otra

Consecuencia:

- tokens gastados reconstruyendo contexto que debió estar explícito

---

## 14. Plantilla mínima para arrancar una futura v3

Orden recomendado:

1. crear `project-brief.md`
2. crear `architecture.md`
3. crear `spec-index.md`
4. definir `specs/001-*`, `002-*`, `003-*`
5. definir auth y deploy antes de tocar el flujo principal
6. implementar una spec a la vez

---

## 15. Regla final

La velocidad real no viene de escribir código más rápido.

Viene de:

- decidir mejor antes
- reducir ambigüedad
- construir menos caminos alternativos
- validar antes de seguir

Si este playbook se respeta, una futura `v3` debería requerir menos debugging, menos retrabajo y menos tokens que `v2`.
