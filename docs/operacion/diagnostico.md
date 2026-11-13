# Diagnóstico en producción

Cómo se investiga un problema que no se reproduce en local. Las consultas de ejemplo son para Log Analytics (KQL) una vez desplegado en Azure (fase 6); en local, los mismos campos se filtran con `jq` sobre la salida de la API.

## Método

1. **Contener el impacto.** Antes de entender, limitar el daño: revertir el último despliegue (swap de slots), desactivar la feature o escalar. Se diagnostica con el servicio estable.
2. **Medir.** Logs, métricas y consultas lentas. Nada de suposiciones: ¿desde cuándo?, ¿a quién afecta?, ¿qué endpoint?, ¿qué cambió en ese momento?
3. **Aislar la causa.** Reducir a la petición, la consulta o el componente. El correlation id lleva de un reporte de usuario a todo lo que pasó en esa petición.
4. **Corregir.** El cambio mínimo que resuelve la causa, no el síntoma.
5. **Evitar que se repita.** Una prueba que lo reproduce, una alerta que lo habría detectado antes y, si afectó a usuarios, un postmortem sin culpables.

## Lo que ya da el sistema

| Herramienta                                                                                                          | Dónde                     |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Correlation id en cada respuesta (`X-Request-Id`) y en todos los logs de esa petición (`req.id`)                     | `src/common/logging.ts`   |
| Una línea por petición con método, URL, estado y duración (`responseTime`)                                           | pino-http                 |
| Eventos de seguridad: `auth.login_failed` (con motivo), `auth.account_locked`, `auth.login_succeeded`, `auth.logout` | `AuthService`             |
| Health check con ping a la base                                                                                      | `GET /health`             |
| Errores de base traducidos (409/400) y el resto registrado como `error` sin exponer SQL al cliente                   | `DatabaseExceptionFilter` |

```bash
# En local: logs legibles
npm run dev:api | npx pino-pretty
# Todo lo de una petición
npm run dev:api | jq 'select(.req.id == "<id>")'
```

## Escenarios

### Un usuario reporta "me dio error"

Pedirle el `X-Request-Id` (la web puede mostrarlo en el mensaje de error) o la hora aproximada.

```kusto
AppTraces | where Properties.req.id == "<id>" | order by TimeGenerated asc
```

### La base de datos está lenta

1. ¿Es la base o la app? Comparar `responseTime` de las peticiones con la duración de las consultas.
2. `pg_stat_statements`: las consultas con mayor `total_exec_time` y `mean_exec_time` (en Azure Flexible Server se activa como extensión).
3. `EXPLAIN (ANALYZE, BUFFERS)` de la consulta culpable: buscar `Seq Scan` sobre tablas grandes, `Sort` en disco y estimaciones de filas muy distintas de las reales (estadísticas viejas: `ANALYZE`).
4. Métricas del servidor: CPU, IOPS, conexiones. Si las conexiones están al máximo, el problema puede ser el pool, no las consultas.

Ejemplo real en este proyecto: la lectura de mensajes sin índice (fase 5b, `docs/rendimiento/`).

### Un endpoint tiene timeouts intermitentes

"Intermitente" suele ser contención, no código lento:

- **Pool de conexiones agotado**: picos de tráfico o transacciones largas que retienen conexiones. Síntoma: latencia que sube para todos los endpoints a la vez.
- **Locks**: una migración o una transacción larga bloquea filas. `pg_stat_activity` con `wait_event_type = 'Lock'` y `pg_locks`.
- **Dependencia externa** lenta (fase 7): por eso el circuit breaker y los timeouts explícitos.
- **Una instancia enferma** de varias: agrupar latencia por `cloud_RoleInstance`.

Defensa ya prevista: `statement_timeout` y tamaño de pool configurables (fase 5b), y transacciones cortas (el hash de argon2 se calcula fuera de la transacción).

### Un endpoint sobrecarga la base

1. Identificarlo: peticiones por endpoint y consultas por endpoint (¿N+1?). La lectura de mensajes trae el autor en la misma consulta justamente para evitar N+1.
2. Contener: rate limit por usuario o IP, o desactivar temporalmente.
3. Corregir: índice, paginación por cursor en lugar de `OFFSET`, caché si los datos lo permiten.

### Deadlocks en producción

Postgres los detecta y aborta una de las transacciones (`40P01 deadlock detected`), y lo registra con las consultas implicadas.

- **Causa típica**: dos transacciones que bloquean las mismas filas en distinto orden.
- **Corrección**: tocar las filas siempre en el mismo orden, transacciones más cortas, o una sola sentencia atómica (como el contador de intentos fallidos de la fase 1).
- **Mitigación**: reintentar la transacción completa ante `40P01` o `40001`, con un límite.

### Muchos inicios de sesión fallidos o cuentas bloqueadas

```kusto
AppTraces
| where Properties.event in ("auth.login_failed", "auth.account_locked")
| summarize intentos = count() by bin(TimeGenerated, 5m), tostring(Properties.reason)
```

Muchos `unknown_identifier` desde pocas IPs indica enumeración de códigos; muchos `account_locked` en pocos minutos, un ataque de bloqueo dirigido (mejora M1 en el modelo de amenazas). Ambos merecen una alerta.

## Niveles de log

| Nivel   | Cuándo                                            | Ejemplo                                        |
| ------- | ------------------------------------------------- | ---------------------------------------------- |
| `error` | Falló algo que requiere acción                    | Respuesta 5xx, error de base no esperado       |
| `warn`  | Algo anómalo pero manejado                        | Login fallido, cuenta bloqueada, respuesta 4xx |
| `info`  | Eventos de negocio y una línea por petición       | Login correcto, petición completada            |
| `debug` | Solo para diagnosticar, desactivado en producción | Socket desconectado y motivo                   |

En producción, `LOG_LEVEL=info`. Para diagnosticar, se sube a `debug` temporalmente con una variable de entorno, sin redesplegar código.
