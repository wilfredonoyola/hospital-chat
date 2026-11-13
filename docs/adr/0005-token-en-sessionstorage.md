# 0005. Token de acceso en sessionStorage, con sesión corta y cierre por inactividad

- Estado: aceptada
- Fecha: 2026-11-12

## Contexto

La web corre en PCs compartidas de estaciones de enfermería (amenaza A4). El navegador necesita el JWT para dos cosas: las peticiones HTTP a la API y el handshake del socket del chat. La API y la web pueden vivir en dominios distintos (App Service de la fase 6).

## Decisión

- El token se guarda en **`sessionStorage`**: se borra al cerrar la pestaña, no sobrevive a reiniciar el navegador y no se comparte entre pestañas.
- **Cierre por inactividad** en el cliente (10 minutos por defecto), además de la vida corta del token en el servidor (30 minutos).
- Cualquier 401 cierra la sesión local; el socket la cierra si el servidor la invalida.
- Defensa contra XSS: React escapa todo el texto (los mensajes se muestran, no se interpretan; hay una prueba de eso) y no se usa `dangerouslySetInnerHTML`.

## Alternativas consideradas

| Opción                                                                      | A favor                                                                  | En contra                                                                                                                                 |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `sessionStorage` + sesión corta + inactividad (elegida)                     | Simple; funciona igual para HTTP y socket; se borra al cerrar la pestaña | Un XSS puede leer el token mientras la pestaña está abierta                                                                               |
| `localStorage`                                                              | Sobrevive al cierre del navegador                                        | En una PC compartida es justo lo que no queremos; mismo riesgo de XSS                                                                     |
| Cookie `httpOnly` + `SameSite` emitida por la API                           | JavaScript no puede leer el token: un XSS no lo roba                     | Requiere protección CSRF, mismo sitio o un BFF para dominios distintos; el socket debe autenticarse por cookie; más piezas que configurar |
| BFF en Next.js (la cookie la maneja el servidor de Next y reenvía a la API) | El navegador nunca ve el token                                           | Next se vuelve proxy de todas las llamadas y del socket; más latencia y otra capa que operar                                              |
| Token solo en memoria                                                       | Ni siquiera persiste en la pestaña                                       | Recargar la página cierra la sesión; mala experiencia en turnos largos                                                                    |

## Consecuencias

- El riesgo principal que queda es **XSS**: un script inyectado podría leer el token mientras la sesión está abierta. Se mitiga con el escape de React, la vida corta del token y la revocación por `token_version`.
- **Antes de producción** agregaría una Content Security Policy estricta (con nonces) en Next.js, que bloquea scripts inyectados aunque aparezca un hueco de XSS.
- Si el hospital exige que el token nunca sea accesible desde JavaScript, el camino es cookie `httpOnly` con la API y la web bajo el mismo sitio (por ejemplo, `chat.hospital.com` y `api.chat.hospital.com`), sin cambiar el resto del cliente: solo `apiFetch` y el handshake del socket.
