# Plan — Spec 003

## Fases

### Fase A — Esqueleto y contrato
1. FastAPI app con `/health` y stubs de `/optimize` y `/validate` que retornan 501.
2. Modelos Pydantic del payload (idéntico a `docs/architecture.md`).
3. Dockerfile y docker-compose entry para el servicio.

### Fase B — Greedy
4. Implementar `greedy.py` siguiendo el pseudocódigo de `math-formulation.md` §7.
5. Wire greedy a `/optimize` cuando `modo == "greedy"`.
6. Fixture + test.

### Fase C — Lower bound y diagnóstico
7. `lower_bound.py` con la fórmula de §5.
8. Endpoint devuelve `dotacion_suficiente` con diagnóstico aunque el ILP no corra.

### Fase D — Validator
9. `validators.py` chequea las 8 condiciones de §8.
10. `/validate` funcional.
11. Test de cada violación.

### Fase E — ILP
12. `ilp.py` con modelo CP-SAT siguiendo §2, §3, §4.
13. Linealización de valor absoluto (balance).
14. Opción B de múltiples propuestas (perturbación de pesos).
15. Fixture + test.

### Fase F — Pulido
16. Tuneo de pesos default basados en escenarios reales.
17. Time-outs y mensajes de error amigables.
18. Documentación OpenAPI con ejemplos.

## Decisiones técnicas clave

### CP-SAT vs LP
Usamos **CP-SAT** (no LP clásico) porque:
- Las variables son binarias → es un problema entero nativo.
- CP-SAT de OR-Tools es extraordinariamente rápido para este tamaño.
- Permite restricciones no-lineales (ej: "si hace turno X el lunes, no puede hacer turno Y el martes") con un API cómodo.

### Tiempo discretizado
- Usamos slots de **30 minutos** para chequear cobertura.
- Los turnos del catálogo siempre comienzan y terminan en múltiplos de 30 min (incluyendo 10:30, 20:30, etc.) → no hay problemas de granularidad.

### Semana ISO
- Semanas lunes-domingo.
- Una semana puede atravesar dos meses → para el optimizador del mes M, ignoramos las horas de los días del mes M-1. Es decir, la regla de 42h aplica a los **días del mes objetivo dentro de esa semana**. Esto genera leve imprecisión en semanas parciales (típicamente la primera y última del mes), pero es la única forma de mantener el problema mensual acotado.
- Registramos esta simplificación en los logs para auditar.

## Dependencias `requirements.txt`

```
fastapi==0.110.*
uvicorn[standard]==0.27.*
pydantic==2.*
ortools==9.10.*
python-dateutil==2.9.*
pytest==8.*
pytest-cov==5.*
httpx==0.27.*
```

## Riesgos

- ILP infactible por restricciones duras contradictorias → el validator previo al solver debe detectar esto (ej: sumar horas obligatorias prohibidas > disponibles).
- Solver lento en casos patológicos → capar a 30 s y devolver la mejor solución encontrada hasta entonces.
- Diferencia de criterios entre ILP y greedy en "semana parcial" → documentar y alinear.
