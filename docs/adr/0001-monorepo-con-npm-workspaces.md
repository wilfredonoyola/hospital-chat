# 0001. Monorepo con npm workspaces

- Estado: aceptada
- Fecha: 2026-11-12

## Contexto

El sistema tiene API (NestJS), web (Next.js) y más adelante una app móvil (Expo). Las tres hablan el mismo idioma: usuarios, áreas, mensajes, prioridades. Si cada una define sus tipos por separado, un cambio en la API rompe el cliente sin que nadie se entere hasta producción.

## Decisión

Un solo repositorio con npm workspaces: `apps/api`, `apps/web`, `apps/mobile` y `packages/shared` para los tipos y contratos compartidos. Un solo `package-lock.json` y un solo CI.

## Alternativas consideradas

| Opción                                  | A favor                                                               | En contra                                                                                             |
| --------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| npm workspaces (elegida)                | Viene con Node, cero herramientas extra, suficiente para 3–4 paquetes | Sin caché de tareas ni ejecución por grafo de dependencias                                            |
| Turborepo / Nx                          | Caché local y remota, solo corre lo que cambió                        | Una herramienta más que aprender y configurar; el beneficio aparece con muchos paquetes o un CI lento |
| pnpm workspaces                         | Instalación más rápida y menos disco, dependencias estrictas          | Otra herramienta en las máquinas del equipo y en el CI                                                |
| Repos separados + paquete npm publicado | Despliegues y permisos independientes                                 | Versionar y publicar `shared` en cada cambio; los cambios cruzados requieren varios PRs coordinados   |

## Consecuencias

- Un PR puede cambiar contrato, API y cliente a la vez, y el CI valida los tres juntos.
- Si el CI pasa de unos 10 minutos o el número de paquetes crece, el siguiente paso es Turborepo encima de los mismos workspaces, sin mover carpetas.
- Si un equipo distinto se hace dueño de una app, se puede extraer con su historial (`git subtree split`).
