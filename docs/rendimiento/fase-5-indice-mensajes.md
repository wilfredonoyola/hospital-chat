# Fase 5 — Índice de mensajes y paginación por cursor

Medición en PostgreSQL 17 local (Docker), con ~300 000 mensajes generados con [`volumen.sql`](volumen.sql): 180 000 en Emergencias, 100 000 en UCI y 20 000 en Pediatría, repartidos en 90 días. Cada consulta se corrió tres veces y se tomó la última (caché caliente).

## Resumen

| Consulta                                           | Antes (sin índice)                                       | Después (con índice)                  |
| -------------------------------------------------- | -------------------------------------------------------- | ------------------------------------- |
| Página más reciente del canal (51 filas con autor) | **60,1 ms**, 4 477 bloques, `Parallel Seq Scan` + `Sort` | **0,26 ms**, 35 bloques, `Index Scan` |
| Página en la posición 10 000 con `OFFSET`          | —                                                        | 1,8 ms, 77 bloques                    |
| Página en la posición 10 000 con **cursor**        | —                                                        | **0,15 ms**, 6 bloques                |

El índice hace la lectura del canal unas **230 veces más rápida** y lee **128 veces menos** bloques. El cursor mantiene el costo constante sin importar qué tan atrás esté la página; `OFFSET` crece linealmente, porque lee y descarta todas las filas anteriores.

## La consulta

```sql
SELECT m.id, m.department_id, m.body, m.priority, m.created_at, u.id, u.full_name, u.role
  FROM messages m JOIN users u ON u.id = m.author_id
 WHERE m.department_id = $1
 ORDER BY m.created_at DESC, m.id DESC
 LIMIT 51;  -- 50 + 1 para saber si hay página anterior
```

## Antes: sin índice

```
Limit (actual time=59.362..60.005 rows=51 loops=1)
  Buffers: shared hit=4477
  ->  Gather Merge (actual time=59.361..59.997 rows=51 loops=1)
        Workers Launched: 2
        ->  Sort (actual time=53.978..53.982 rows=45 loops=3)
              Sort Key: m.created_at DESC, m.id DESC
              Sort Method: top-N heapsort
              ->  Hash Join (actual time=0.124..36.581 rows=60010 loops=3)
                    ->  Parallel Seq Scan on messages m (actual time=0.008..17.516 rows=60010 loops=3)
                          Filter: (department_id = (InitPlan 1).col1)
                          Rows Removed by Filter: 40000
Execution Time: 60.100 ms
```

**Lectura:** Postgres recorre **toda la tabla** en paralelo (3 procesos), se queda con las 180 000 filas de Emergencias, las une con `users` y las **ordena** para devolver 51. El costo crece con el tamaño del área, no con el tamaño de la página, y ocupa tres procesos por petición.

## Después: `messages (department_id, created_at DESC, id DESC)`

```
Limit (actual time=0.056..0.197 rows=51 loops=1)
  Buffers: shared hit=35
  ->  Nested Loop (actual time=0.055..0.191 rows=51 loops=1)
        ->  Index Scan using messages_department_created_idx on messages m (actual time=0.042..0.151 rows=51 loops=1)
              Index Cond: (department_id = (InitPlan 1).col1)
        ->  Memoize (Hits: 49  Misses: 2)
              ->  Index Scan using users_pkey on users u (rows=1 loops=2)
Execution Time: 0.262 ms
```

**Lectura:** el índice ya está ordenado como lo pide la consulta. Postgres lee las primeras 51 entradas del área y se detiene: sin `Sort`, sin recorrer la tabla. El autor se busca por llave primaria y `Memoize` evita repetir la búsqueda para el mismo autor.

## Por qué este índice

- **Columnas en el orden de la consulta:** primero la igualdad (`department_id`), después el orden (`created_at DESC, id DESC`). Al revés no serviría para filtrar por área.
- **`id` como desempate:** dos mensajes pueden tener la misma fecha; sin `id`, el orden entre ellos no es estable y el cursor podría saltar o repetir uno.
- **`CREATE INDEX CONCURRENTLY`:** se construye sin bloquear las escrituras. En producción el chat sigue recibiendo mensajes mientras tanto. Cuesta más tiempo de construcción y no puede ir dentro de una transacción.
- **La CLI de migraciones corre sin `statement_timeout`**, para que un índice sobre una tabla grande no se cancele a la mitad.

## Por qué cursor y no `OFFSET`

|                                         | `OFFSET`                             | Cursor (`before`)             |
| --------------------------------------- | ------------------------------------ | ----------------------------- |
| Costo de la página N                    | Crece con N (lee y descarta N filas) | Constante                     |
| Si llegan mensajes nuevos entre páginas | Se repiten mensajes                  | Sin repetidos ni saltos       |
| Saltar a la página 37                   | Posible                              | No (no hace falta en un chat) |

La prueba e2e `recorre el canal hacia atrás sin repetir ni saltar, aunque lleguen mensajes nuevos` lo verifica. Con `OFFSET`, el mensaje que llegó en medio desplazaría la segunda página y repetiría uno.

## Qué se descartó

- **Índice solo en `department_id`:** filtra, pero igual habría que ordenar todas las filas del área.
- **Índice cubriente (`INCLUDE (body, ...)`)**: evitaría leer la tabla, pero duplica el texto de los mensajes en el índice. Con 35 bloques por página no hace falta.
- **Particionar `messages` por fecha:** útil con cientos de millones de filas o para borrar meses enteros; hoy es complejidad sin beneficio.

## Cómo reproducirlo

```bash
docker compose exec -T db psql -U hospital_chat -d hospital_chat < docs/rendimiento/volumen.sql
# EXPLAIN (ANALYZE, BUFFERS) de la consulta de arriba; luego:
npm run migration:run -w @hospital-chat/api
# y repetir el EXPLAIN
```
