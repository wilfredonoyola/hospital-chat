# SPEC — Fase 2: mensajes por área

Issue: #3 · Decisión: [ADR 0004](../adr/0004-mensajes-con-nestjs-estandar.md)

## Objetivo

El personal escribe y lee mensajes en los canales de sus áreas. Un supervisor puede marcar un mensaje como urgente. Nadie lee ni escribe en un área a la que no pertenece.

## Reglas de negocio

| #   | Regla                                                                          | Dónde vive                              |
| --- | ------------------------------------------------------------------------------ | --------------------------------------- |
| R1  | Solo quien pertenece a un área **activa** puede leer o escribir en ella        | `MessagesService`, no el controller     |
| R2  | Solo un `SUPERVISOR` puede enviar mensajes `URGENT`; el `STAFF` envía `NORMAL` | `message-rules.ts` (función pura)       |
| R3  | El texto se recorta y debe tener de 1 a 2000 caracteres                        | `message-rules.ts` y `CHECK` en la base |
| R4  | La fecha del mensaje la pone el servidor, no el cliente                        | Service, con el reloj inyectado         |
| R5  | Un admin no escribe en el chat: no pertenece a ningún área                     | Consecuencia de R1                      |

R1 cierra la amenaza **"empleado curioso"** que en la fase 1 quedó fuera de alcance ([amenazas](../amenazas.md)).

## Endpoints

| Método | Ruta                                           | Acceso           | Qué hace                                                                                  |
| ------ | ---------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------- |
| POST   | `/departments/:departmentId/messages`          | Miembro del área | Envía `{ body, priority? }`. `priority` por defecto `NORMAL`                              |
| GET    | `/departments/:departmentId/messages?limit=50` | Miembro del área | Últimos mensajes, el más reciente primero, con nombre y rol del autor. `limit` de 1 a 100 |

## Errores

| Caso                                                                     | HTTP                                 |
| ------------------------------------------------------------------------ | ------------------------------------ |
| No pertenece al área, o el área está inactiva o no existe                | 403, mismo mensaje en los tres casos |
| `STAFF` intenta enviar `URGENT`                                          | 403                                  |
| Texto vacío o de más de 2000 caracteres, prioridad inválida, campo extra | 400                                  |

## Criterios de aceptación

1. Un miembro envía un mensaje y lo ve al leer el canal, con su nombre y rol.
2. Alguien de otra área recibe 403 al leer y al escribir.
3. Un área desactivada deja de aceptar lecturas y escrituras (403).
4. `STAFF` + `URGENT` → 403; `SUPERVISOR` + `URGENT` → 201.
5. Los mensajes salen del más reciente al más antiguo, respetando `limit`.
6. La base rechaza un mensaje vacío aunque se inserte por SQL.
7. Las reglas del mensaje se prueban sin base de datos (función pura).
8. La migración se puede revertir.

## Fuera de alcance

- **Tiempo real (Socket.IO)**: fase 4. El comando de envío ya devuelve el mensaje creado; el gateway lo emitirá.
- **Paginación por cursor e índice `messages(department_id, created_at)`**: fase 5. Se dejan a propósito sin índice para medir con `EXPLAIN ANALYZE` antes y después.
- **Editar o borrar mensajes**: en un contexto clínico, lo dicho queda dicho; si hiciera falta, sería una corrección visible, no un borrado.
- **Eventos de dominio** (mensaje urgente → notificación): fase 7.
