# SPEC — Fase 1: base y autenticación

Issue: #2 · Amenazas: [docs/amenazas.md](../amenazas.md)

## Objetivo

El personal entra con su código y PIN y ve sus áreas; el administrador entra con email y contraseña y gestiona áreas y personal. Todo lo demás de la API queda cerrado por defecto.

## Roles y credenciales

| Rol          | Credencial         | Quién lo crea                                                               |
| ------------ | ------------------ | --------------------------------------------------------------------------- |
| `ADMIN`      | email + contraseña | Solo el seed, desde variables de entorno. La API no crea ni promueve admins |
| `SUPERVISOR` | código + PIN       | Un admin, por API. En la fase 2 podrá enviar mensajes urgentes              |
| `STAFF`      | código + PIN       | Un admin, por API                                                           |

- Código: 3 a 12 caracteres, letras mayúsculas y números (`ENF001`). Único.
- PIN: 4 a 6 dígitos. Se rechazan todos iguales (`0000`) y secuencias (`1234`, `4321`).
- Contraseña de admin: mínimo 12 caracteres.

## Modelo de datos

- `departments`: nombre único sin distinguir mayúsculas, descripción, activo.
- `users`: nombre, rol, email o código, hash de contraseña o de PIN (`select: false`), activo, intentos fallidos, bloqueado hasta, versión de sesión.
  - `CHECK`: un admin tiene email y contraseña y nada más; el personal tiene código y PIN y nada más.
- `department_members`: usuario ↔ área (muchos a muchos).
- `audit_logs`: actor, acción, entidad, id, metadatos (jsonb), IP, fecha.

## Endpoints

| Método | Ruta                         | Acceso              | Qué hace                                          |
| ------ | ---------------------------- | ------------------- | ------------------------------------------------- |
| POST   | `/auth/staff/login`          | Público, rate limit | Código + PIN → token                              |
| POST   | `/auth/admin/login`          | Público, rate limit | Email + contraseña → token                        |
| GET    | `/auth/me`                   | Autenticado         | Usuario actual con sus áreas                      |
| POST   | `/auth/logout`               | Autenticado         | Invalida todos los tokens del usuario             |
| GET    | `/admin/departments`         | Admin               | Lista de áreas                                    |
| POST   | `/admin/departments`         | Admin               | Crear área                                        |
| PATCH  | `/admin/departments/:id`     | Admin               | Renombrar, describir, activar o desactivar        |
| GET    | `/admin/users`               | Admin               | Lista del personal con sus áreas                  |
| POST   | `/admin/users`               | Admin               | Crear supervisor o personal con sus áreas         |
| PATCH  | `/admin/users/:id`           | Admin               | Nombre, rol (`SUPERVISOR`/`STAFF`), activo, áreas |
| POST   | `/admin/users/:id/reset-pin` | Admin               | Nuevo PIN; desbloquea e invalida sus sesiones     |
| GET    | `/admin/audit-logs`          | Admin               | Últimas acciones de administración                |
| GET    | `/health`                    | Público             | Ya existe                                         |

## Criterios de aceptación

1. Sin token, cualquier endpoint que no sea `@Public()` responde **401**.
2. Un `STAFF` o `SUPERVISOR` en `/admin/*` recibe **403**.
3. Código inexistente, cuenta inactiva, cuenta bloqueada y PIN incorrecto responden **el mismo 401 con el mismo mensaje**.
4. Al quinto PIN incorrecto la cuenta queda bloqueada 15 minutos; un login correcto reinicia el contador.
5. Más de 10 intentos de login por minuto desde la misma IP responden **429**.
6. Desactivar a alguien, resetear su PIN o hacer logout invalida sus tokens: la siguiente petición responde **401**.
7. Mandar un campo que no está en el DTO responde **400**. No se puede crear ni promover un `ADMIN` por API.
8. Código de personal o nombre de área duplicado responde **409**; un área inexistente al asignar responde **400**.
9. La base rechaza un usuario cuya credencial no corresponde a su rol, aunque se inserte directo por SQL.
10. Ninguna respuesta incluye hashes.
11. Cada acción de admin queda en `audit_logs` en la misma transacción que el cambio.
12. `npm run seed` se puede correr varias veces sin duplicar nada.
13. Las migraciones se pueden revertir (`down`).

## Fuera de alcance

- Tokens de refresco: con sesiones de 30 minutos en PCs compartidas, volver a poner el PIN es lo deseable. Se revisa si el cliente móvil (fase 9) lo necesita.
- Recuperar contraseña de admin por email: el admin se gestiona por variables de entorno.
- SSO corporativo (Entra ID) y segundo factor.
- Borrar usuarios: se desactivan, para no romper la auditoría ni el historial de mensajes.

## Preguntas abiertas

- ¿Cómo se migraría el admin a Entra ID sin romper a los usuarios actuales? Propuesta: agregar `auth_provider` y `external_id`, aceptar ambos métodos durante la transición y retirar la contraseña local al final. Se decide si el proyecto llega a producción.
