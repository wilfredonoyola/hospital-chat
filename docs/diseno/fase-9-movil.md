# Fase 9 — App móvil con Expo (diseño)

Estado: **diseñado, no implementado**. Issue: #10

## Objetivo

Que el personal reciba los **urgentes en el celular** aunque no esté frente a la estación, y pueda leer y responder en sus áreas.

## Decisiones

| Tema                   | Decisión                                                                                      | Por qué                                                                                                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework              | **Expo** (React Native) en `apps/mobile` del monorepo                                         | Mismo lenguaje, mismos tipos (`packages/shared`) y mismos patrones (TanStack Query, Zustand) que la web. EAS para builds y actualizaciones                                                                          |
| Token                  | **`expo-secure-store`** (Keychain en iOS, Keystore en Android)                                | El equivalente a lo que en la web no se puede tener: almacenamiento cifrado por el sistema. Nunca `AsyncStorage` para el token                                                                                      |
| Sesión                 | Sesión **por dispositivo** con _refresh token_ rotativo                                       | El ADR 0003 lo dejó previsto: en un celular personal no se quiere pedir el PIN cada 30 minutos, a diferencia de una PC compartida. Se agrega una tabla de sesiones para revocar un dispositivo sin cerrar los demás |
| Desbloqueo             | Biometría (`expo-local-authentication`) para reabrir la app                                   | Rápido y sin escribir el PIN en público                                                                                                                                                                             |
| Urgentes               | **Notificaciones push** (Expo Notifications → APNs/FCM) disparadas por el worker de la fase 7 | Con la app cerrada no hay socket; la notificación es el único canal confiable. El contenido no lleva datos clínicos: solo "Urgente en Emergencias", y el detalle se ve al abrir la app autenticada                  |
| Tiempo real            | Socket mientras la app está en primer plano; al volver del fondo se relee por HTTP            | El sistema operativo suspende los sockets en segundo plano; el patrón de reconexión de la web ya hace esto                                                                                                          |
| Reutilización          | `messages-cache.ts` y los tipos se mueven a `packages/shared` (o a un paquete `chat-core`)    | Deduplicación, envío optimista y orden son la misma lógica; ya están probados                                                                                                                                       |
| Lo que no se reutiliza | Componentes de UI                                                                             | React Native no renderiza HTML; se reescribe la vista, no la lógica                                                                                                                                                 |

## Riesgos

- **Datos clínicos en un dispositivo personal**: si se pierde el celular, la sesión se revoca desde el panel (sesión por dispositivo) y la app no guarda mensajes en disco, solo en memoria.
- **Notificaciones que no llegan** (modo no molestar, permisos denegados): para urgentes críticos, el worker de la fase 7 puede escalar a SMS o llamada si nadie confirma en N minutos.
- **Tiendas de apps**: la distribución interna (TestFlight, Google Play testing o MDM del hospital) evita publicar una app clínica en la tienda pública.

## Fuera de alcance del MVP

La app, el refresh token, la tabla de sesiones por dispositivo y las notificaciones push.
