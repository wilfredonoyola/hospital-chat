# Cómo contribuir

## Flujo

1. Cada cambio nace de un issue.
2. Rama desde `main` con el prefijo del tipo de cambio:
   - `feat/` funcionalidad nueva (`feat/fase-1-auth`)
   - `fix/` corrección
   - `chore/` herramientas, dependencias, configuración
   - `docs/` solo documentación
   - `refactor/` cambio interno sin cambiar comportamiento
3. Antes del código, un `SPEC.md` corto en la carpeta del módulo o en `docs/specs/` (Spec-Driven Development): qué se construye, qué queda fuera, criterios de aceptación.
4. Si hay una decisión de arquitectura, un ADR en `docs/adr/` (copiar `0000-plantilla.md`).
5. Las pruebas van en el mismo PR que el código que prueban. Un PR de funcionalidad sin pruebas no se integra (ver [Pruebas](#pruebas)).
6. Pull Request hacia `main` con la plantilla completa, incluida la sección **Qué no hice y por qué**: decir qué se dejó fuera a propósito vale tanto como lo que se hizo. El CI debe pasar.
7. Merge con **squash**: un commit por PR en `main`, con el título del PR.

`main` está protegida: no se hace push directo.

## Pruebas

| Tipo                    | Dónde                            | Qué cubre                                                                     |
| ----------------------- | -------------------------------- | ----------------------------------------------------------------------------- |
| Unitarias               | `*.spec.ts` junto al código      | Reglas de negocio con dependencias falsas (sin base, sin red)                 |
| Integración / e2e (API) | `apps/api/test/*.e2e-spec.ts`    | Endpoints contra Postgres real: guards, restricciones de la base, migraciones |
| Componentes (web)       | `*.test.tsx` junto al componente | Comportamiento visible con Testing Library; API simulada con MSW              |
| E2E (web)               | `apps/web/e2e`                   | Solo los flujos críticos, con Playwright                                      |

No se prueban getters, DTOs sin lógica ni el propio framework. La hora y los servicios externos se inyectan para poder reemplazarlos en las pruebas.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/) en español:

```
feat(auth): login del personal con código y PIN
fix(messages): no duplicar mensajes al reconectar el socket
chore(ci): ejecutar pruebas en cada Pull Request
```

## Antes de abrir el PR

```bash
npm run lint
npm run typecheck
npm test
```
