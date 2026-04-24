# Tasks — Spec 001 Optimizer Playground

## Objetivo de implementación

Construir una primera vertical slice funcional de `v3` para validar el solver antes del resto del sistema.

## Tareas

### 1. Scaffold inicial

- [ ] Crear la estructura inicial de `v3`
- [ ] Definir la ruta `/admin/optimizer-lab`
- [ ] Preparar layout base visualmente alineado a `v1/v2`

### 2. Catálogo mínimo para pruebas

- [ ] Definir una categoría dominical base para el playground
- [ ] Definir turnos y parámetros mínimos para esa categoría
- [ ] Incorporar fixtures o seeds mínimos de feriados y configuración

### 3. Formulario de entrada

- [ ] Selector de año
- [ ] Selector de mes
- [ ] Selector o input de dotación
- [ ] Inputs de parámetros del solver
- [ ] Botón `Generar`

### 4. Contrato backend ↔ optimizer

- [ ] Definir payload técnico para el optimizer playground
- [ ] Definir response con propuestas + diagnóstico
- [ ] Preparar validación del payload

### 5. Integración con solver

- [ ] Invocar el servicio de optimización desde la web app
- [ ] Manejar respuesta factible
- [ ] Manejar respuesta infactible
- [ ] Mostrar dotación mínima sugerida cuando exista

### 6. Resultado visual

- [ ] Renderizar propuestas
- [ ] Mostrar score y métricas resumidas
- [ ] Mostrar grilla mensual por slots anónimos
- [ ] Resaltar libres, domingos y cobertura relevante

### 7. Diagnóstico y observabilidad

- [ ] Mostrar mensajes del solver en UI
- [ ] Registrar logs básicos de corrida
- [ ] Preparar el punto de extensión para persistencia futura

### 8. Cierre de la spec

- [ ] Probar casos con dotación suficiente
- [ ] Probar casos con dotación insuficiente
- [ ] Confirmar que la pantalla sirve como laboratorio real para decidir cómo seguir con el MVP
