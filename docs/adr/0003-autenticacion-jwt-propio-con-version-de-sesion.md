# 0003. Autenticación con JWT propio, sin Passport, y versión de sesión en la base

- Estado: aceptada
- Fecha: 2026-11-12

## Contexto

Dos tipos de usuario con credenciales distintas: personal con código + PIN en PCs compartidas, y administradores con email + contraseña. Necesitamos poder **cortar el acceso al instante**: cuando se desactiva a alguien, cuando un admin resetea un PIN porque sospecha un robo, o cuando alguien cierra sesión en una PC compartida. Un JWT puro no se puede revocar antes de que venza. Ver [docs/amenazas.md](../amenazas.md), A4 y A5.

## Decisión

1. **JWT firmado con HS256**, algoritmo e issuer fijados al verificar. Vida de 30 minutos.
2. **Guard propio** (`JwtAuthGuard`, unas 40 líneas) registrado como guard global, sin Passport.
3. El token lleva `sub` y `ver` (versión de sesión), **no el rol**. En cada petición el guard lee de la base, por llave primaria, `is_active`, `role` y `token_version`. Si la versión no coincide, el token está revocado.
4. Logout, desactivar y resetear el PIN incrementan `token_version`: todos los tokens de esa persona dejan de servir en la siguiente petición.

## Alternativas consideradas

| Opción                                            | A favor                                                                                 | En contra                                                                                                                                                           |
| ------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JWT + versión en la base (elegida)                | Revocación inmediata; el rol vigente siempre es el de la base; una sola consulta por PK | Una consulta por petición: la API deja de ser 100 % stateless                                                                                                       |
| JWT puro (stateless)                              | Cero consultas; escala trivialmente                                                     | No se puede revocar: un token robado vale hasta que vence; un cambio de rol tarda en aplicar                                                                        |
| Lista negra de tokens (Redis)                     | Revoca tokens individuales                                                              | Infraestructura extra; hay que guardar cada token revocado hasta que venza                                                                                          |
| Sesiones en servidor (cookie + tabla de sesiones) | Revocación natural; sin JWT                                                             | Requiere CSRF; peor encaje con la app móvil y con WebSockets de varios clientes                                                                                     |
| Access + refresh token con rotación               | Access muy corto sin pedir PIN seguido                                                  | Más complejidad; en una PC compartida queremos justamente volver a pedir el PIN                                                                                     |
| Passport (`passport-jwt`, `passport-local`)       | Estándar conocido; muchas estrategias (OAuth, SAML)                                     | Para un JWT propio es una capa de indirección (estrategias, `validate`, serialización) que oculta qué se valida; no aporta nada hasta que haya un proveedor externo |

## Consecuencias

- Una consulta por PK por petición, menos de 1 ms. A escala se cachea `token_version` en Redis con invalidación al cambiar, sin cambiar el contrato.
- Si llega SSO corporativo (Entra ID), Passport o `@azure/msal-node` entra **solo para el login del admin**. El guard sigue validando nuestro propio JWT, así que el resto de la API no cambia.
- Revocar es por persona, no por dispositivo: logout cierra la sesión en todos los equipos. Para un hospital con PCs compartidas es lo deseable; si la app móvil necesita sesiones por dispositivo, se agrega una tabla de sesiones.
