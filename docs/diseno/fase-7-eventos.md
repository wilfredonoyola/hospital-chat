# Fase 7 — Eventos: comparar RabbitMQ, Kafka y Service Bus, y elegir uno (diseño)

Estado: **diseñado, no implementado**. Issue: #8

## El caso

Cuando un supervisor envía un mensaje **urgente**, hay que notificar fuera del chat (push al celular, SMS o el sistema de llamadas del hospital). Esa notificación es lenta y puede fallar; no debe hacer lenta ni fallar la respuesta del `POST /messages`.

```
POST /messages ──► guardar mensaje + evento (outbox) en una transacción ──► 201
                                   │
                   relay ──► broker ──► worker de notificaciones ──► proveedor externo
                                                │                        (circuit breaker)
                                                └─► reintentos con backoff ─► DLQ
```

## ¿Hace falta un broker?

Antes de elegir uno: **¿una llamada directa basta?** Si la notificación fuera rápida, confiable y su falla aceptable, se haría en línea. Aquí no: el proveedor externo es lento, falla, y un urgente **no se puede perder**. El broker desacopla el tiempo de respuesta y da reintentos y persistencia.

## Comparación con este caso

|                     | RabbitMQ                                              | Kafka                                                                     | Azure Service Bus                                                                       |
| ------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Modelo              | Colas y exchanges; el mensaje se borra al confirmarlo | Log particionado; el mensaje se queda y cada consumidor lleva su offset   | Colas y tópicos administrados                                                           |
| Reintentos y DLQ    | DLX (dead-letter exchange), configurable              | No nativo: se arma con tópicos de reintento                               | **Nativos**: reintentos con contador y DLQ por cola                                     |
| Releer el historial | No                                                    | **Sí**: reiniciar el offset                                               | No (salvo lo que esté en la cola)                                                       |
| Orden               | Por cola                                              | Por partición (clave = área)                                              | Por sesión (clave = área)                                                               |
| Duplicados          | El consumidor debe ser idempotente                    | Igual                                                                     | **Detección de duplicados** por id en una ventana de tiempo, más consumidor idempotente |
| Operación           | Hay que operarlo (cluster, quorum queues)             | La más pesada (o Event Hubs / Confluent administrado)                     | **Administrado**                                                                        |
| Encaja cuando       | Tareas con reintentos, ruteo flexible, on-premise     | Streaming de alto volumen, varios consumidores que releen, event sourcing | Mensajería de negocio en Azure con poca operación                                       |

## Decisión

**Azure Service Bus** (cola `urgent-notifications`).

- El sistema ya vive en Azure (fase 6): sin infraestructura extra que operar.
- Reintentos, DLQ, detección de duplicados y mensajes programados vienen incluidos: es casi todo lo que este caso necesita.
- El volumen es bajo (urgentes de un hospital, no millones de eventos por segundo).

**Cuándo cambiaría de opinión:**

- **Kafka** (o Event Hubs con su API) si aparecen varios consumidores que necesitan **releer** eventos (analítica, auditoría reconstruible, un modelo de lectura que se recalcula) o el volumen pasa a ser de streaming.
- **RabbitMQ** si el hospital exige todo **on-premise**.

El dominio no depende de la elección: un puerto `EventPublisher` con un adaptador por broker (`BROKER=servicebus|rabbitmq|kafka`), como se comparó en el plan.

## Patrones

| Patrón                                     | Para qué                                                                     | Cómo                                                                                                                                                                                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Outbox**                                 | No perder el evento si el broker está caído en el momento del `POST`         | El mensaje y una fila en `outbox` se guardan en **la misma transacción**. Un relay lee `outbox` y publica; marca publicado al confirmar el broker. Sin outbox, "guardar y luego publicar" puede guardar y no publicar (o al revés) |
| **Consumidor idempotente**                 | El broker entrega _al menos una vez_: el mismo evento puede llegar dos veces | Tabla `processed_events (event_id PRIMARY KEY)`: se inserta en la misma transacción que el efecto; si ya existe, se ignora. El id del evento es el del mensaje                                                                     |
| **Retry con backoff exponencial y jitter** | Fallas transitorias del proveedor                                            | 1 s, 2 s, 4 s… con aleatoriedad para no reintentar todos a la vez; tope de intentos                                                                                                                                                |
| **Dead-letter queue**                      | Lo que falla siempre no debe bloquear la cola                                | Tras N intentos va a la DLQ, con alerta. Se revisa y se reprocesa a mano                                                                                                                                                           |
| **Circuit breaker** (`opossum`)            | Si el proveedor está caído, no martillarlo ni acumular hilos esperando       | Tras varias fallas seguidas, el circuito se abre y se falla rápido durante un tiempo; luego deja pasar una prueba                                                                                                                  |
| **Timeout** en la llamada externa          | Una llamada colgada retiene al worker                                        | Siempre explícito, menor que el tiempo de bloqueo del mensaje en la cola                                                                                                                                                           |

## Ventajas y desventajas frente a REST

- **A favor:** la API responde rápido; el worker escala aparte; una caída del proveedor no tumba el chat; los reintentos y la DLQ dejan rastro.
- **En contra:** consistencia eventual (la notificación llega después); más piezas que operar y observar; depurar requiere seguir el evento entre servicios (el `X-Request-Id` de la fase 5 viaja como propiedad del mensaje).

## ¿Por qué separarlo en un microservicio?

El worker de notificaciones tiene otro perfil de carga y de fallas que la API: escala por profundidad de la cola, no por peticiones HTTP, y puede caerse sin afectar el chat. Se despliega aparte, pero **comparte el repositorio** (monorepo, ADR 0001) y el contrato del evento en `packages/shared`. No se separan más piezas mientras no tengan esa diferencia de ciclo de vida.

## Fuera de alcance del MVP

Implementar el outbox, el relay, el worker y los tres adaptadores, y levantar RabbitMQ y Kafka en Docker para el ejercicio de comparación.
