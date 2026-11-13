# Hospital Chat

Mensajería interna para el personal de un hospital: cada área (Emergencias, UCI, Farmacia…) tiene su canal, el personal entra con un código y un PIN desde cualquier equipo compartido, y los mensajes urgentes se destacan y disparan notificaciones.

Es un proyecto de laboratorio: está construido como si fuera a producción (ramas por feature, Pull Requests, CI, ADRs y specs antes del código) para mostrar cómo trabajo como desarrollador full stack senior con NestJS y React/Next.js.

## Stack

| Parte             | Tecnología                                    | Carpeta           |
| ----------------- | --------------------------------------------- | ----------------- |
| API               | NestJS, TypeORM, PostgreSQL                   | `apps/api`        |
| Web               | Next.js (App Router), TanStack Query, Zustand | `apps/web`        |
| Tipos compartidos | TypeScript                                    | `packages/shared` |
| Mobile            | Expo (React Native)                           | `apps/mobile`     |

## Inicio rápido

Requisitos: Node 24 (`nvm use`) y Docker.

```bash
docker compose up -d db                       # PostgreSQL 17 (crea también la base de pruebas)
npm install
cp apps/api/.env.example apps/api/.env        # cambia JWT_SECRET y ADMIN_PASSWORD
npm run migration:run -w @hospital-chat/api
npm run seed -w @hospital-chat/api            # idempotente: se puede repetir
npm run dev:api                               # http://localhost:3001
cp apps/web/.env.example apps/web/.env.local
npm run dev:web                               # http://localhost:3000
```

- Documentación de la API (Swagger): http://localhost:3001/docs
- Health check: `GET http://localhost:3001/health`
- Base de datos: en el navegador con Adminer (`docker compose --profile tools up -d adminer` → http://localhost:8080) o con `docker compose exec db psql -U hospital_chat -d hospital_chat`. Credenciales, tablas y consultas de ejemplo: [docs/base-de-datos.md](docs/base-de-datos.md)

Si ya tenías el volumen de Postgres de antes, crea la base de pruebas una vez:
`docker compose exec db createdb -U hospital_chat hospital_chat_test`

### Usuarios de demostración

Los crea el seed fuera de producción. Qué puede hacer cada uno y casos para probar: [docs/usuarios-demo.md](docs/usuarios-demo.md).

| Quién          | Rol          | Credenciales                               | Áreas            |
| -------------- | ------------ | ------------------------------------------ | ---------------- |
| Administrador  | `ADMIN`      | `ADMIN_EMAIL` / `ADMIN_PASSWORD` de `.env` | —                |
| Carla Rivas    | `SUPERVISOR` | `SUP001` / `7391`                          | Emergencias, UCI |
| Ana Martínez   | `STAFF`      | `ENF001` / `2580`                          | Emergencias      |
| Luis Hernández | `STAFF`      | `ENF002` / `4826`                          | UCI, Pediatría   |
| Sofía Campos   | `STAFF`      | `FAR001` / `6153`                          | Farmacia         |

```bash
curl -X POST localhost:3001/auth/staff/login \
  -H 'Content-Type: application/json' -d '{"staffCode":"ENF001","pin":"2580"}'
```

Enviar un mensaje urgente como supervisora (el id del área sale de `GET /auth/me`):

```bash
curl -X POST localhost:3001/departments/<departmentId>/messages \
  -H "Authorization: Bearer <token>" -H 'Content-Type: application/json' \
  -d '{"body":"Código azul en sala 3","priority":"URGENT"}'
```

### Pruebas

```bash
npm test             # unitarias, sin base de datos
npm run test:e2e     # e2e contra Postgres real (base hospital_chat_test)
```

## Documentación

- [Modelo de amenazas](docs/amenazas.md)
- [Diagnóstico en producción](docs/operacion/diagnostico.md)
- [Rendimiento: índice de mensajes y cursor](docs/rendimiento/fase-5-indice-mensajes.md)
- [Diseños de las fases 6 a 9](docs/diseno)
- [Specs por fase](docs/specs)
- [Decisiones de arquitectura (ADR)](docs/adr)

## Hoja de ruta

Cada fase se entrega en su propia rama y Pull Request, con su `SPEC.md` y los ADR de las decisiones importantes.

**Alcance: MVP.** Las fases 1 a 5 están construidas, probadas y medidas. Las fases 6 a 9 están [diseñadas](docs/diseno) pero no implementadas: se construirían cuando haya un disparador real (usuarios, despliegue, otro cliente).

| Fase | Qué incluye                                                                                                            | Estado                  |
| ---- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 1    | Base y autenticación: código + PIN para el personal, email + contraseña para admin, JWT, roles, rate limit, auditoría  | Hecha                   |
| 2    | Mensajes por área con reglas de negocio; hexagonal y CQRS documentados como evolución (ADR 0004)                       | Hecha                   |
| 3    | Estrategia de pruebas: ADR, cobertura mínima como gate en CI, pruebas de contrato (cada fase trae sus propias pruebas) | Hecha                   |
| 4    | Web en Next.js con chat en tiempo real (Socket.IO)                                                                     | Hecha                   |
| 5    | Logs estructurados, correlation ID, índices y paginación por cursor                                                    | Hecha                   |
| 6    | Despliegue en Azure y adjuntos con Blob Storage (SAS)                                                                  | [Diseñada](docs/diseno) |
| 7    | Eventos con RabbitMQ, Kafka y Azure Service Bus; retry, circuit breaker, DLQ                                           | [Diseñada](docs/diseno) |
| 8    | CI/CD completo: análisis de seguridad, Docker y despliegue                                                             | [Diseñada](docs/diseno) |
| 9    | App móvil con Expo                                                                                                     | [Diseñada](docs/diseno) |

## Cómo trabajamos

Ver [CONTRIBUTING.md](CONTRIBUTING.md) y las decisiones de arquitectura en [`docs/adr`](docs/adr).
