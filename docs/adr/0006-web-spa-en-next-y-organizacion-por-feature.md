# 0006. La web es una SPA dentro de Next.js, organizada por feature; evolución a cookie httpOnly y proxy.ts

- Estado: aceptada
- Fecha: 2026-11-13
- Relacionada con: [0005](0005-token-en-sessionstorage.md)

## Contexto

Por el ADR 0005 el token vive en `sessionStorage`, que no existe en el servidor. Como consecuencia, todas las pantallas autenticadas se renderizan solo en el cliente (`ssr: false`) y la protección de rutas ocurre en el navegador. En la práctica la web es una SPA dentro de Next.js: no aprovecha Server Components, `proxy.ts` ni el renderizado en servidor.

Además, la primera versión organizaba los archivos por tipo (`components/`, `lib/`), y `ChatScreen` acumulaba sesión, perfil, socket, inactividad y layout.

## Decisión

**Organización por feature**, con fronteras verificadas por el lint:

```
src/
  app/        rutas finas; la única capa que compone features (p. ej. SessionGuard + ChatScreen)
  features/
    auth/     login, SessionGuard, cierre por inactividad
    chat/     pantalla, canal, mensajes, compositor, socket, caché
  lib/        lo transversal: cliente HTTP, sesión, logout
```

- Una feature no importa de otra; `lib/` no importa de ninguna feature. Lo hace cumplir `no-restricted-imports` en ESLint.
- **No** se usa diseño atómico (atoms/molecules/organisms): sirve para un sistema de diseño compartido entre productos; en una app genera discusiones de clasificación y separa los componentes de la lógica que usan. Si aparecen piezas genéricas repetidas, van a `ui/`.

**Se mantiene la SPA** mientras el token esté en `sessionStorage`.

## Alternativas consideradas

| Opción                                                               | A favor                                                                                                              | En contra                                                                                                |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| SPA en Next + organización por feature (elegida)                     | Coherente con el ADR 0005; cada cambio toca una carpeta; fronteras verificadas                                       | No aprovecha el servidor de Next                                                                         |
| Next "de verdad": cookie `httpOnly` + `proxy.ts` + Server Components | Rutas protegidas en el servidor (sin parpadeo); carga inicial renderizada; el token no es accesible desde JavaScript | Requiere API y web bajo el mismo sitio, autenticar el socket por cookie y protección CSRF                |
| Vite + React (SPA pura)                                              | Más simple si nunca se usará el servidor                                                                             | El plan incluye un panel admin y despliegue donde el servidor de Next sí suma; migrar después cuesta más |
| Organización por tipo (`components/`, `hooks/`, `lib/`)              | Familiar                                                                                                             | Un cambio de una feature toca muchas carpetas; nadie sabe qué se puede borrar                            |
| Diseño atómico                                                       | Útil para un design system                                                                                           | Ver arriba                                                                                               |

## Cuándo y cómo pasar a Next "de verdad"

Disparador: el despliegue de la fase 6, cuando la API y la web compartan sitio (por ejemplo `chat.hospital.com` y `api.chat.hospital.com`), o si el hospital exige que el token no sea accesible desde JavaScript.

1. La API emite el token en una cookie `httpOnly; Secure; SameSite=Lax` y acepta esa cookie además del header.
2. `proxy.ts` de Next redirige a `/login` sin cookie válida, antes de renderizar.
3. `/chat` carga perfil y primeros mensajes en un Server Component; el socket y el envío siguen en el cliente.
4. El socket se autentica con la cookie del handshake.
5. Se quitan `SessionGuard` y `ssr: false`. Las features no cambian de forma: solo `lib/api.ts`, `lib/session-store.ts` y la capa `app/`.

## Consecuencias

- Un cambio del chat toca `features/chat/`; el panel admin tendrá su `features/admin/`.
- Las fronteras se rompen en el lint, no en la revisión de código.
- La migración a cookie `httpOnly` está acotada a `lib/` y `app/`.
