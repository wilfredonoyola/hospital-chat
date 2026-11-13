# Fase 8 — CI/CD completo (diseño)

Estado: **diseñado, parcialmente implementado**. El CI actual ya corre formato, lint, tipos, pruebas unitarias, e2e en paralelo con cobertura y build en cada PR, y `main` está protegida. Falta lo de abajo. Issue: #9

## Pipeline

```
PR ──► CI (hoy) ──────────────────────────────► revisión ──► squash merge a main
       formato · lint · tipos · unitarias · e2e + cobertura · build
       + CodeQL · dependencias vulnerables · Playwright (nuevo)

main ──► build de imágenes ──► push a ACR ──► deploy a slot staging ──► humo ──► swap a producción
         (etiqueta = SHA)                     (migraciones antes)        │
                                                                         └─ falla → no hay swap
```

## Qué se agrega

| Paso                           | Herramienta                                                                                          | Por qué                                                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Análisis estático de seguridad | **CodeQL** (GitHub Advanced Security, gratis en repos públicos)                                      | Detecta inyección, XSS, secretos y patrones inseguros en TypeScript                                                  |
| Dependencias vulnerables       | **Dependabot** (alertas y PRs de actualización) + `npm audit --omit=dev --audit-level=high` en el CI | Falla el PR si entra una dependencia de producción con vulnerabilidad alta                                           |
| Secretos en el código          | _Secret scanning_ + _push protection_ de GitHub                                                      | Bloquea el push que contiene una clave                                                                               |
| E2E de navegador               | **Playwright** con Chromium, contra API y web levantadas en el job                                   | Automatiza la prueba de humo que hoy se hace a mano (login, urgente en tiempo real, scroll, borrador entre usuarios) |
| Imágenes                       | Docker multi-stage, una por app                                                                      | Ver abajo                                                                                                            |
| Registro                       | Azure Container Registry, etiqueta = SHA del commit                                                  | Cada despliegue es trazable a un commit; el rollback es desplegar la imagen anterior                                 |
| Credenciales del pipeline      | **OIDC (federated credentials)** de GitHub Actions a Azure                                           | Sin secretos de larga vida guardados en GitHub                                                                       |
| Despliegue                     | Slot `staging` → prueba de humo → **swap** (fase 6)                                                  | Sin downtime; rollback en segundos                                                                                   |
| Migraciones                    | Job propio antes del deploy, con la CLI (sin `statement_timeout`)                                    | Siguen expand/contract: el código anterior funciona con el esquema nuevo                                             |

## Dockerfile de la API (multi-stage)

```dockerfile
FROM node:24-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace @hospital-chat/api --include-workspace-root

FROM deps AS build
COPY . .
RUN npm run build -w @hospital-chat/api && npm prune --omit=dev

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
USER node
EXPOSE 3001
HEALTHCHECK CMD wget -qO- http://localhost:3001/health || exit 1
CMD ["node", "dist/main.js"]
```

- **Multi-stage:** la imagen final no lleva TypeScript, herramientas de build ni dependencias de desarrollo.
- **`USER node`:** no corre como root.
- **`npm ci`** con el lockfile: builds reproducibles.
- La web usa `output: 'standalone'` de Next.js para una imagen igual de pequeña.

## Git y Pull Requests (ya aplicado)

- `main` protegida: sin push directo, CI obligatorio, rama al día, conversaciones resueltas, historial lineal.
- Ramas `feat/`, `fix/`, `chore/`, `docs/`, `refactor/`; Conventional Commits; **squash merge**.
- Plantilla de PR con _Qué no hice y por qué_ y _Riesgos y cómo revertir_.
- **Lección del proyecto:** PRs encadenados más squash merge generan conflictos en el segundo PR. Se resuelven trayendo `main` y, en el lockfile, regenerándolo con `npm install`, nunca a mano.

## Fuera de alcance del MVP

Implementar CodeQL, Playwright, los Dockerfiles y el despliegue (este último depende de la fase 6).
