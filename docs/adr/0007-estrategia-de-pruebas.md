# 0007. Estrategia de pruebas

- Estado: aceptada
- Fecha: 2026-11-13

## Contexto

Cada PR ya trae sus pruebas (CONTRIBUTING). Faltaba escribir **qué** se prueba en cada nivel, qué no, cómo se aíslan la hora y los servicios externos, cómo se mide la cobertura sin convertirla en un número vacío, y cómo se protege el contrato entre la API y los clientes.

## Decisión

### Niveles

| Nivel                     | Herramienta                                    | Qué prueba                                                           | Ejemplos                                                                                                | Cuánto                                  |
| ------------------------- | ---------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Unitarias (API)           | Jest                                           | Reglas y decisiones sin base: funciones puras y servicios con dobles | `validateNewMessage`, política de PIN, cursor, `AuthService` con reloj y hasher falsos, guards, filtros | Muchas, milisegundos                    |
| Integración / e2e (API)   | Jest + supertest + Postgres y Socket.IO reales | El comportamiento por HTTP y socket, con la base de verdad           | Los criterios de aceptación de cada SPEC, `CHECK`, migraciones, plan con índice, `statement_timeout`    | Una por criterio                        |
| Componentes y hooks (web) | Vitest + Testing Library                       | Lo que el usuario ve y hace, y la lógica de los hooks                | Login, compositor, urgentes, caché del socket, envío optimista, `SessionGuard`                          | Por comportamiento                      |
| Navegador real            | Chrome headless (manual hoy)                   | Lo que jsdom no puede: layout, scroll, flujo completo                | Scroll que no salta, urgente en tiempo real sin duplicar                                                | Pocas; Playwright en el CI en la fase 8 |
| Contrato                  | TypeScript + `packages/shared`                 | Que la API y los clientes hablen lo mismo                            | Ver abajo                                                                                               | —                                       |

No es una pirámide estricta: en una API cuyo valor está en hablar bien con Postgres, las e2e contra la base real dan más confianza por prueba que unitarias con el ORM simulado. Las unitarias se reservan para lógica con muchos casos (reglas, políticas, cursor), donde una e2e por caso sería lenta y ruidosa.

### Qué no se prueba

- **Getters, DTOs sin lógica, entidades, módulos de Nest, configuración**: se prueban solos al compilar y al levantar la app en las e2e.
- **El framework**: que NestJS llame a un guard o que React re-renderice.
- **Detalles de implementación**: los componentes se prueban por lo que muestran y hacen (Testing Library), no por su estado interno. Así un refactor no rompe pruebas: las 13 e2e de mensajes pasaron sin cambios al simplificar la fase 2, y las de la web sin cambios al reorganizar por feature.
- **Mocks del ORM**: un mock de TypeORM no detecta un `CHECK` mal escrito ni un índice que no se usa. Lo que depende de la base se prueba contra la base.

### Hora y servicios externos

- **Hora**: se inyecta (`Clock`). El bloqueo de 15 minutos se prueba moviendo un reloj falso, no esperando.
- **Servicios con costo o lentitud** (argon2, más adelante brokers y notificaciones): se inyectan como clases abstractas (`PasswordHasher`) y en las unitarias se reemplazan por implementaciones falsas, no por mocks sueltos.
- **Navegador y red en la web**: `fetch` y `socket.io-client` se simulan; el contrato de lo que devuelven es el de `packages/shared`.

### Cobertura: un piso, no una meta

- Se mide sobre lo que tiene lógica: en la API, con las **e2e** (cubren servicios, controllers y guards contra la base real); en la web, `features/` y `lib/`.
- El CI falla si baja del **piso**, fijado un poco por debajo de lo medido al introducirlo. Funciona como trinquete: se sube cuando la cobertura sube, nunca se baja para que pase un PR.
- No se persigue el 100 %: las líneas sin cubrir que quedan son composición (`ChatScreen`, `Channel`) o necesitan un navegador real (scroll de `MessageList`).
- La primera medición sirvió: encontró `SessionGuard` (protección de rutas) y el envío optimista sin pruebas, y se agregaron.

### Contrato API ↔ clientes

- Los controllers devuelven los tipos de `packages/shared` (`UserProfile`, `LoginResponse`, `MessagePage`, `MessageView`) y la web los consume. Un cambio incompatible **rompe el build** de la API o de la web.
- `contract.spec.ts` verifica en el typecheck que los roles y prioridades de la API sean exactamente los del contrato, en las dos direcciones.
- **Pact (contratos dirigidos por el consumidor)** se descarta mientras API y clientes vivan en el mismo repositorio y se desplieguen juntos. Se adopta si la app móvil o un tercero consume la API desde otro repositorio con su propio ciclo de despliegue.

### E2E en paralelo

Cada worker de Jest usa su propia base (`hospital_chat_test_<worker>`), creada en el `globalSetup`. Los archivos de un worker corren en serie y vacían solo su base; los workers corren en paralelo sin pisarse. Se descartó una transacción por prueba con rollback: las pruebas de concurrencia, de `statement_timeout`, de migraciones y del socket necesitan transacciones y conexiones reales.

## Alternativas consideradas

| Opción                                                | A favor                                                        | En contra                                                            |
| ----------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------- |
| Esta estrategia (elegida)                             | Confianza alta donde importa; las pruebas sobreviven refactors | E2E más lentas que unitarias                                         |
| Pirámide clásica (muchas unitarias con mocks de todo) | Rapidísimas                                                    | Mocks del ORM y de HTTP que pasan mientras producción falla          |
| Meta de cobertura alta (90–100 %)                     | Número fácil de reportar                                       | Incentiva probar getters y detalles; las pruebas se vuelven frágiles |
| Una sola base para todas las e2e (`--runInBand`)      | Simple                                                         | No escala: el CI se alarga con cada archivo nuevo                    |

## Consecuencias

- Las reglas de negocio nuevas llegan con unitarias; los endpoints nuevos, con una e2e por criterio del SPEC.
- Subir el piso de cobertura es parte del PR que la sube.
- En local se corren solo las pruebas relacionadas con el cambio; la suite completa la corre el CI.
