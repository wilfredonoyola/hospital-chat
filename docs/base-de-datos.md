# Explorar la base de datos en local

Postgres corre en Docker (`docker compose up -d db`). Hay dos formas de entrar.

## Opción 1: en el navegador (Adminer)

```bash
docker compose --profile tools up -d adminer
```

Abre http://localhost:8080 y entra con:

| Campo         | Valor           |
| ------------- | --------------- |
| Sistema       | PostgreSQL      |
| Servidor      | `db`            |
| Usuario       | `hospital_chat` |
| Contraseña    | `hospital_chat` |
| Base de datos | `hospital_chat` |

- **Ver tablas:** clic en una tabla (`users`, `messages`…) → «Seleccionar datos» para ver filas, «Mostrar estructura» para columnas, índices y claves foráneas.
- **Ejecutar SQL:** menú izquierdo → «Comando SQL», pega la consulta y «Ejecutar».
- **Apagarlo:** `docker compose stop adminer`.

Adminer usa el perfil `tools`, así que `docker compose up` no lo arranca, y su puerto solo escucha en `127.0.0.1`.

Servidor `db` (no `localhost`) porque Adminer corre dentro de la red de Docker. Desde un cliente instalado en tu Mac (DBeaver, TablePlus, pgAdmin) usa `localhost:5432` con las mismas credenciales.

## Opción 2: en la terminal (psql)

```bash
docker compose exec db psql -U hospital_chat -d hospital_chat
```

| Comando       | Para qué                             |
| ------------- | ------------------------------------ |
| `\dt`         | Lista las tablas                     |
| `\d messages` | Columnas, índices y FKs de una tabla |
| `\x`          | Vista vertical (filas largas)        |
| `\timing`     | Muestra cuánto tarda cada consulta   |
| `\q`          | Salir                                |

## Tablas

| Tabla                | Qué guarda                                                  |
| -------------------- | ----------------------------------------------------------- |
| `departments`        | Áreas del hospital (Emergencias, UCI…)                      |
| `users`              | Personal y admin. Rol, código + hash del PIN o email + hash |
| `department_members` | Quién pertenece a qué área (PK `user_id, department_id`)    |
| `messages`           | Mensajes por área, con `priority` `NORMAL` o `URGENT`       |
| `audit_logs`         | Acciones de administración (quién, qué, cuándo)             |

Los PIN y contraseñas se guardan como hash argon2id: no se pueden leer ni «desencriptar».

## Consultas de ejemplo

Mensajes por área, incluidas las que no tienen ninguno (`LEFT JOIN` + `GROUP BY`):

```sql
SELECT d.name, count(m.id) AS mensajes
FROM departments d
LEFT JOIN messages m ON m.department_id = d.id
GROUP BY d.name
ORDER BY mensajes DESC;
```

Quién envió urgentes y cuántos:

```sql
SELECT u.full_name, count(*) AS urgentes
FROM users u
JOIN messages m ON m.author_id = u.id
WHERE m.priority = 'URGENT'
GROUP BY u.full_name;
```

Áreas de cada usuario en una sola fila (`string_agg`):

```sql
SELECT u.full_name, string_agg(d.name, ', ' ORDER BY d.name) AS areas
FROM users u
JOIN department_members dm ON dm.user_id = u.id
JOIN departments d ON d.id = dm.department_id
GROUP BY u.full_name;
```

Personal que nunca ha escrito (`NOT EXISTS`):

```sql
SELECT u.full_name
FROM users u
WHERE u.role <> 'ADMIN'
  AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.author_id = u.id);
```

Último mensaje de cada área (`JOIN LATERAL`):

```sql
SELECT d.name, m.body, m.created_at
FROM departments d
JOIN LATERAL (
  SELECT body, created_at
  FROM messages
  WHERE department_id = d.id
  ORDER BY created_at DESC
  LIMIT 1
) m ON true;
```

## ¿Usa el índice?

Antepón `EXPLAIN ANALYZE` a una consulta. `Index Scan` usa un índice; `Seq Scan` recorre toda la tabla.

```sql
EXPLAIN ANALYZE
SELECT id, body FROM messages
WHERE department_id = (SELECT id FROM departments WHERE name = 'Emergencias')
ORDER BY created_at DESC, id DESC
LIMIT 50;
```

Con pocas filas Postgres puede preferir `Seq Scan` porque es más barato; el índice `(department_id, created_at DESC, id DESC)` se nota con volumen. Ver [rendimiento/fase-5-indice-mensajes.md](rendimiento/fase-5-indice-mensajes.md).
