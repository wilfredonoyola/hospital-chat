# 0004. Arquitectura hexagonal y CQRS solo en el módulo de mensajes

- Estado: aceptada
- Fecha: 2026-11-12

## Contexto

Mensajes es el único módulo con reglas de negocio reales: quién puede escribir dónde, quién puede marcar urgente, qué es un mensaje válido. Además va a crecer por dos lados distintos. La **escritura** tendrá efectos (evento de urgente en la fase 7, emisión por socket en la fase 4). La **lectura** tendrá exigencias de rendimiento (paginación por cursor e índices en la fase 5). Áreas y usuarios, en cambio, son CRUD con auditoría.

## Decisión

**Hexagonal (puertos y adaptadores)** en `messages/`:

```
messages/
  domain/          Message, reglas y errores. Sin NestJS, sin TypeORM.
  application/     Casos de uso: SendMessage (comando) y GetMessages (consulta).
                   Dependen de puertos (clases abstractas), no de implementaciones.
  infrastructure/  Adaptadores TypeORM que implementan los puertos.
  http/            Controller, DTOs y traducción de errores de dominio a HTTP.
```

La regla de dependencias apunta hacia adentro: `http` e `infrastructure` conocen a `application` y `domain`; nunca al revés.

**CQRS** con `@nestjs/cqrs`, en la misma base de datos:

- **Comando** `SendMessageCommand`: pasa por el dominio (`Message.create` valida las reglas) y se guarda con el puerto `MessageRepository`.
- **Consulta** `GetMessagesQuery`: no pasa por el dominio. Usa un puerto de lectura (`MessageReadModel`) que devuelve directamente lo que la pantalla necesita, con el nombre del autor ya unido en SQL.

Usuarios y áreas **siguen como CRUD**.

## Alternativas consideradas

| Opción                                                 | A favor                                                                                   | En contra                                                                                                  |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Hexagonal + CQRS solo en mensajes (elegida)            | Reglas que se prueban sin base ni framework; lectura y escritura evolucionan por separado | Dos estilos en el mismo proyecto: hay que explicar por qué (este ADR)                                      |
| Hexagonal en todos los módulos                         | Un solo estilo                                                                            | En un CRUD, triplica archivos (entidad, dominio, mapper, puerto, adaptador) sin ninguna regla que proteger |
| Servicio de NestJS con TypeORM directo (como usuarios) | Menos archivos, más rápido                                                                | Las reglas quedan mezcladas con la persistencia; probarlas exige base o mocks del ORM                      |
| CQRS con base de lectura separada                      | Lectura escalable de forma independiente                                                  | Consistencia eventual y otra base que operar, para un volumen que una sola Postgres maneja de sobra        |

## Consecuencias

- El dominio y los casos de uso se prueban con un repositorio en memoria: milisegundos, sin Docker.
- Cambiar TypeORM por otra cosa en mensajes toca solo `infrastructure/`.
- La consulta puede optimizarse (cursor, índices, vista materializada, réplica de lectura) sin tocar el comando.
- CQRS aquí **no** significa dos bases de datos: significa dos caminos de código. Si algún día la lectura necesita escalar aparte, el puerto `MessageReadModel` permite apuntarlo a una réplica sin cambiar los handlers.
- Si otro módulo gana reglas de negocio de verdad, se migra al mismo estilo. No antes.
