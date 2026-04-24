# Tasks - Spec 001 Optimizer Playground

## Objetivo de implementacion

Construir una primera vertical slice funcional de `v3` para validar el solver antes del resto del sistema.

## Tareas

### 1. Scaffold inicial

- [x] Crear la estructura inicial de `v3`
- [x] Definir la ruta `/admin/optimizer-lab`
- [x] Preparar layout base visualmente alineado a `v1/v2`

### 2. Catalogo minimo para pruebas

- [x] Definir una categoria dominical base para el playground
- [x] Definir turnos y parametros minimos para esa categoria
- [ ] Incorporar fixtures o seeds minimos de feriados y configuracion

### 3. Formulario de entrada

- [x] Selector de ano
- [x] Selector de mes
- [x] Selector o input de dotacion
- [x] Inputs de parametros del solver
- [x] Boton `Generar`

### 4. Contrato backend -> optimizer

- [x] Definir payload tecnico para el optimizer playground
- [x] Definir response con propuestas + diagnostico
- [x] Preparar validacion del payload

### 5. Integracion con solver

- [x] Invocar el servicio de optimizacion desde la web app
- [x] Manejar respuesta factible
- [x] Manejar respuesta infactible
- [x] Mostrar dotacion minima sugerida cuando exista

### 6. Resultado visual

- [x] Renderizar propuestas
- [x] Mostrar score y metricas resumidas
- [x] Mostrar grilla mensual por slots anonimos
- [x] Resaltar libres, domingos y cobertura relevante

### 7. Diagnostico y observabilidad

- [x] Mostrar mensajes del solver en UI
- [ ] Registrar logs basicos de corrida
- [x] Preparar el punto de extension para persistencia futura

### 8. Cierre de la spec

- [x] Probar casos con dotacion suficiente
- [x] Probar casos con dotacion insuficiente
- [ ] Confirmar que la pantalla sirve como laboratorio real para decidir como seguir con el MVP
