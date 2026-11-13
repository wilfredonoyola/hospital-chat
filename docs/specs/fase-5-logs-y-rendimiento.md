# SPEC — Fase 5: logs y rendimiento

Issue: #6 · Se entrega en dos PRs: **5a** (observabilidad) y **5b** (rendimiento).

## Objetivo

Que un problema en producción se pueda **encontrar** (logs que se buscan y se correlacionan) y que la lectura de mensajes siga siendo rápida con volumen real (índice medido, paginación por cursor, límites de tiempo).

## 5a — Observabilidad

| Tema                 | Decisión                                                                                                                                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formato              | Logs **JSON** con `nestjs-pino`: una línea por evento, campos que se filtran en Application Insights o Log Analytics (fase 6)                                                                                                       |
| Correlation ID       | Cada petición lleva un id: se respeta `X-Request-Id` si llega de un proxy (Front Door) o se genera uno. Va en todos los logs de esa petición y vuelve en la respuesta                                                               |
| Datos sensibles      | Se redactan `Authorization`, cookies, `pin` y `password`. Nunca se registra un cuerpo completo                                                                                                                                      |
| Niveles              | `error`: falló algo que requiere acción. `warn`: algo anómalo pero manejado (cuenta bloqueada, sesión inválida). `info`: eventos de negocio y una línea por petición. `debug`: solo para diagnosticar. Configurable con `LOG_LEVEL` |
| Ruido                | `/health` no se registra: el balanceador lo llama cada pocos segundos                                                                                                                                                               |
| Eventos de seguridad | `auth.login_succeeded`, `auth.login_failed` (con motivo interno, nunca en la respuesta), `auth.account_locked`, `auth.logout`. Base de la detección de la mejora M2                                                                 |

### Criterios de aceptación — 5a

1. Toda respuesta trae `X-Request-Id`; si la petición ya traía uno válido, se respeta.
2. Los logs de una petición comparten ese id.
3. Un login fallido deja un log `warn` con el motivo interno (código inexistente, inactivo, bloqueado, PIN incorrecto) sin el PIN, mientras la respuesta sigue siendo el mismo 401 genérico.
4. Ningún log contiene el token, el PIN ni la contraseña.
5. Existe una guía de diagnóstico para los escenarios de producción del plan.

## 5b — Rendimiento

| Tema       | Decisión                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Índice     | `messages (department_id, created_at DESC, id DESC)`: cubre el filtro y el orden de la lectura del canal. Se crea `CONCURRENTLY` para no bloquear escrituras |
| Medición   | `EXPLAIN (ANALYZE, BUFFERS)` antes y después con volumen generado, resultados en `docs/rendimiento/`                                                         |
| Paginación | Por **cursor** (`before`), no por `OFFSET`: el costo no crece con la página y no salta ni repite mensajes si llegan nuevos mientras se pagina                |
| Límites    | `statement_timeout` y tamaño del pool configurables: una consulta lenta no retiene una conexión indefinidamente                                              |
| Web        | `useInfiniteQuery` con "Cargar mensajes anteriores"                                                                                                          |

### Criterios de aceptación — 5b

1. `GET /messages` responde `{ items, nextCursor }`; con `before=<cursor>` devuelve la página anterior sin repetir ni saltar mensajes, aunque lleguen mensajes nuevos entre páginas.
2. Un cursor inválido responde 400.
3. El plan de la consulta usa el índice (sin `Sort` ni `Seq Scan` sobre `messages`), documentado antes y después.
4. Una consulta que excede `statement_timeout` se corta y responde 503, no deja la petición colgada.
5. La web carga mensajes anteriores sin perder los que llegan en tiempo real.

## Fuera de alcance

- Métricas y trazas distribuidas (OpenTelemetry): fase 6 con Application Insights.
- Réplica de lectura o caché: el índice resuelve el volumen esperado; se revisa con métricas reales.
