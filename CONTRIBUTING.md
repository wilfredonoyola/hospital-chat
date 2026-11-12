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
5. Pull Request hacia `main` con la plantilla completa. El CI debe pasar.
6. Merge con **squash**: un commit por PR en `main`, con el título del PR.

`main` está protegida: no se hace push directo.

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
