# Usuarios de demostración y accesos

Datos ficticios que crea `npm run seed` **solo fuera de producción** (`apps/api/src/seed.ts`). Sirven para probar la app en local y para mostrar las reglas de acceso en una demo.

> En producción el seed crea únicamente el administrador, con la contraseña que venga en `.env`. Ningún PIN de esta tabla existe allí.

## Credenciales

| Usuario        | Rol          | Cómo entra                    | Credenciales                                                 | Áreas            |
| -------------- | ------------ | ----------------------------- | ------------------------------------------------------------ | ---------------- |
| Administrador  | `ADMIN`      | Email + contraseña (solo API) | `admin@hospital.local` / `ADMIN_PASSWORD` de `apps/api/.env` | —                |
| Carla Rivas    | `SUPERVISOR` | Código + PIN (web y API)      | `SUP001` / `7391`                                            | Emergencias, UCI |
| Ana Martínez   | `STAFF`      | Código + PIN (web y API)      | `ENF001` / `2580`                                            | Emergencias      |
| Luis Hernández | `STAFF`      | Código + PIN (web y API)      | `ENF002` / `4826`                                            | UCI, Pediatría   |
| Sofía Campos   | `STAFF`      | Código + PIN (web y API)      | `FAR001` / `6153`                                            | Farmacia         |

La contraseña del admin no se documenta: cada entorno pone la suya en `apps/api/.env` (el valor de `.env.example` es solo un ejemplo y debe cambiarse).

Las áreas Laboratorio y Pediatría existen; Laboratorio no tiene miembros de demo.

## Qué puede hacer cada uno

| Acción                                         | Admin | Carla (SUP) | Ana / Luis / Sofía (STAFF) |
| ---------------------------------------------- | :---: | :---------: | :------------------------: |
| Entrar a la web (código + PIN)                 |  No   |     Sí      |             Sí             |
| Leer y escribir en **sus** áreas               |  No¹  |     Sí      |             Sí             |
| Leer o escribir en un área ajena               |  No   |     No      |             No             |
| Enviar mensajes **urgentes**                   |  No   |     Sí      |             No             |
| Gestionar usuarios (`/admin/users`, reset PIN) |  Sí   |     No      |             No             |
| Gestionar áreas (`/admin/departments`)         |  Sí   |     No      |             No             |
| Ver auditoría (`/admin/audit-logs`)            |  Sí   |     No      |             No             |

¹ El admin no pertenece a ningún área; administra, no conversa.

## Casos para probar

| Caso                                   | Con quién                            | Resultado esperado                                                   |
| -------------------------------------- | ------------------------------------ | -------------------------------------------------------------------- |
| Chat en tiempo real entre dos personas | Carla y Ana en Emergencias           | El mensaje aparece en la otra ventana sin recargar                   |
| Mensaje urgente                        | Carla                                | Se ve destacado con el banner «Urgente»                              |
| Urgente sin permiso                    | Ana, `priority: "URGENT"` por API    | `403`                                                                |
| Área ajena                             | Sofía pide mensajes de Emergencias   | `403`                                                                |
| Área compartida                        | Carla y Luis en UCI                  | Ambos ven la misma conversación                                      |
| Endpoint de admin sin ser admin        | Cualquier STAFF → `GET /admin/users` | `403`                                                                |
| Bloqueo por intentos                   | `ENF001` con PIN incorrecto 5 veces  | Cuenta bloqueada 15 min (`LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCK_MINUTES`) |

Para probar dos usuarios a la vez en la web usa dos navegadores o una ventana privada: la sesión vive en `sessionStorage`, una por pestaña.

Si bloqueaste una cuenta de demo, espera los 15 minutos o reiníciala desde la base local:

```sql
UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE staff_code = 'ENF001';
```
