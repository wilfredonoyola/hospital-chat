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

Requisitos: Node 22 (`nvm use`) y Docker.

```bash
docker compose up -d db                       # PostgreSQL 17 en localhost:5432
npm install
cp apps/api/.env.example apps/api/.env
npm run dev:api                               # http://localhost:3001
```

- Health check: `GET http://localhost:3001/health`
- Documentación de la API (Swagger): http://localhost:3001/docs

## Hoja de ruta

Cada fase se entrega en su propia rama y Pull Request, con su `SPEC.md` y los ADR de las decisiones importantes.

| Fase | Qué incluye                                                                                                           | Estado    |
| ---- | --------------------------------------------------------------------------------------------------------------------- | --------- |
| 1    | Base y autenticación: código + PIN para el personal, email + contraseña para admin, JWT, roles, rate limit, auditoría | Pendiente |
| 2    | Arquitectura hexagonal + CQRS en el módulo de mensajes                                                                | Pendiente |
| 3    | Pruebas unitarias y e2e                                                                                               | Pendiente |
| 4    | Web en Next.js con chat en tiempo real (Socket.IO)                                                                    | Pendiente |
| 5    | Logs estructurados, correlation ID, índices y paginación por cursor                                                   | Pendiente |
| 6    | Despliegue en Azure y adjuntos con Blob Storage (SAS)                                                                 | Pendiente |
| 7    | Eventos con RabbitMQ, Kafka y Azure Service Bus; retry, circuit breaker, DLQ                                          | Pendiente |
| 8    | CI/CD completo: análisis de seguridad, Docker y despliegue                                                            | Pendiente |
| 9    | App móvil con Expo                                                                                                    | Pendiente |

## Cómo trabajamos

Ver [CONTRIBUTING.md](CONTRIBUTING.md) y las decisiones de arquitectura en [`docs/adr`](docs/adr).
