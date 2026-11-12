# SPEC — Fase 4: web y chat en tiempo real

Issue: #5 · Se entrega en dos PRs: **4a** (API en tiempo real y tipos compartidos) y **4b** (web en Next.js).

## Objetivo

El personal entra con su código y PIN desde el navegador de la estación de enfermería, ve sus áreas y conversa en tiempo real. Los mensajes urgentes resaltan.

## Decisiones de diseño

| Tema                     | Decisión                                                                                                                             | Por qué                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Escribir                 | Siempre por **HTTP** (`POST /departments/:id/messages`)                                                                              | Un solo camino de escritura con validación, códigos de error y reintentos claros. El socket no duplica reglas |
| Recibir                  | **Socket.IO** solo para empujar mensajes nuevos (`message:new`)                                                                      | El socket es una notificación; si se pierde, la lectura por HTTP es la fuente de verdad                       |
| Salas                    | Una sala por área (`department:<id>`). Para unirse, el servidor comprueba la pertenencia con el mismo `MessagesService` que usa HTTP | La regla del empleado curioso vale igual por socket                                                           |
| Autenticación del socket | El mismo JWT, en el handshake. Se revalida la sesión al unirse a un área y se desconecta al vencer el token                          | Un token revocado no puede unirse a nuevas salas                                                              |
| Reconexión               | Al reconectar, la web vuelve a pedir los mensajes por HTTP                                                                           | Lo que llegó mientras estaba desconectado no se pierde                                                        |
| Duplicados               | La web deduplica por `id` del mensaje                                                                                                | El mismo mensaje puede llegar por la respuesta HTTP y por el socket                                           |
| Contrato                 | `packages/shared` con los tipos que viajan por la red, como archivo de declaraciones (`.d.ts`)                                       | API y web comparten el contrato sin pasos de build extra                                                      |
| Estado en la web         | TanStack Query para datos del servidor; Zustand para sesión, área activa y borradores                                                | Cada tipo de estado en la herramienta que mejor lo maneja                                                     |
| Token en la web          | `sessionStorage` (se borra al cerrar la pestaña) y cierre por inactividad                                                            | PCs compartidas (amenaza A4). Ver el riesgo de XSS en el ADR de la fase 4b                                    |

## Eventos de Socket.IO (namespace `/chat`)

| Dirección          | Evento             | Datos              | Respuesta                                 |
| ------------------ | ------------------ | ------------------ | ----------------------------------------- |
| Cliente → servidor | `department:join`  | `{ departmentId }` | `{ ok: true }` o `{ ok: false, message }` |
| Cliente → servidor | `department:leave` | `{ departmentId }` | `{ ok: true }`                            |
| Servidor → cliente | `message:new`      | `MessageView`      | —                                         |

## Criterios de aceptación — 4a (API)

1. Un socket sin token, o con un token inválido o revocado, queda desconectado.
2. Un miembro se une a la sala de su área y recibe `message:new` cuando alguien envía por HTTP.
3. Unirse a un área ajena responde `{ ok: false }` y no recibe sus mensajes.
4. La respuesta de `POST /messages` y el evento `message:new` tienen la misma forma (`MessageView`, con el autor).
5. Los tipos de `packages/shared` son los que usan la API y la web.

## Criterios de aceptación — 4b (web)

1. Login con código y PIN; un error muestra un mensaje claro sin decir qué falló.
2. Lista de áreas del usuario; al elegir una se ven sus mensajes.
3. Un mensaje enviado desde otra sesión aparece sin recargar.
4. El urgente se distingue a simple vista; solo el supervisor ve la opción de enviarlo.
5. El borrador de cada área se conserva al cambiar de área.
6. Tras un tiempo sin actividad, la sesión se cierra sola.
7. Al cerrar la pestaña, la sesión no sobrevive.

## Fuera de alcance

- **Panel `/admin` en la web**: PR aparte; la API de administración ya existe.
- **Varias instancias de la API**: Socket.IO necesita un adaptador compartido (Redis o Azure Web PubSub) para emitir entre instancias. Se resuelve en la fase 6.
- **E2E del navegador con Playwright**: se evalúa en la fase 8 (descarga ~500 MB de navegadores).
- **Notificaciones push y sonido para urgentes**: fase 7.
