# 0004. Mensajes con la estructura estándar de NestJS; hexagonal y CQRS solo si el sistema crece

- Estado: aceptada
- Fecha: 2026-11-12

## Contexto

Mensajes es el único módulo con reglas de negocio: quién puede leer y escribir en un área, quién puede marcar urgente, qué es un mensaje válido. Más adelante tendrá una segunda entrada (el socket de la fase 4) y exigencias de lectura (paginación e índices en la fase 5).

Se construyó primero con **arquitectura hexagonal y CQRS** (PR #14, rama `feat/fase-2-mensajes`): dominio puro, puertos, adaptadores, command bus y query bus. Funcionaba y estaba bien probada, pero para tres reglas y dos endpoints eran 17 archivos, y la mayoría solo traducía de una capa a otra.

## Decisión

Estructura estándar de NestJS, con **una sola extracción**:

```
messages/
  message.entity.ts       entidad TypeORM
  message-rules.ts        reglas del mensaje en una función pura (se prueba sin base)
  messages.service.ts     pertenencia al área (R1), guardado y lectura
  messages.controller.ts  HTTP
  messages.dto.ts
  messages.module.ts
```

- Las **reglas del mensaje** (texto válido, urgente solo supervisor) están en una función pura: es lo que más cambia y lo que más vale probar aislado.
- La **pertenencia al área** está en el service, no en el controller, para que el socket de la fase 4 la reutilice.
- La **lectura** usa SQL explícito con el autor unido en la misma consulta (sin N+1).

## Alternativas consideradas

| Opción                                       | A favor                                                                                                   | En contra                                                                                                   |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| NestJS estándar + reglas extraídas (elegida) | 7 archivos, cualquier dev de Nest lo entiende en minutos, las reglas se prueban sin base                  | El service depende de TypeORM; cambiar de ORM toca el service                                               |
| Hexagonal + CQRS (construida en el PR #14)   | Dominio independiente del framework; lectura y escritura evolucionan por separado; adaptadores en memoria | 17 archivos para 3 reglas; mucho código de traducción entre capas; más difícil de seguir para alguien nuevo |
| Todo en el controller                        | Lo mínimo                                                                                                 | Las reglas no se pueden reutilizar desde el socket ni probar aisladas                                       |

## Cuándo pasaríamos a hexagonal y CQRS

La versión del PR #14 queda como referencia. Se adopta en este módulo cuando se cumpla **alguno** de estos disparadores, no antes:

1. **Varias entradas que comparten reglas y ya duelen**: HTTP, socket, worker de colas y jobs llamando a la misma lógica, con la tentación de duplicarla.
2. **Las reglas crecen**: estados del mensaje, escalamiento de urgentes, confirmaciones de lectura obligatorias, reglas por turno.
3. **La lectura necesita su propio modelo**: réplica de lectura, vista materializada o un buscador; ahí CQRS separa el camino de lectura sin tocar la escritura.
4. **Hay que cambiar o duplicar la infraestructura**: otra base, o probar contra un adaptador en memoria por velocidad.

El paso sería incremental: primero extraer `Message` como clase de dominio (hoy son reglas en una función), después los puertos de escritura y lectura, y por último el command y query bus si hay varias entradas.

## Consecuencias

- El módulo se lee de arriba abajo en minutos y sigue las convenciones que cualquier dev de NestJS conoce.
- Las reglas tienen pruebas unitarias sin base; el comportamiento completo lo cubren las e2e. Las e2e son **las mismas** que en la versión hexagonal y pasan sin cambios: el contrato HTTP no cambió.
- Si se cumple un disparador, la migración está pensada y hay una implementación de referencia.
