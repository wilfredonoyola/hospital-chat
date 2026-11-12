# 0002. PostgreSQL con TypeORM y esquema solo por migraciones

- Estado: aceptada
- Fecha: 2026-11-12

## Contexto

Los datos son relacionales por naturaleza: usuarios pertenecen a áreas, los mensajes pertenecen a un área y a un autor, las acciones de admin se auditan. Hay reglas que no pueden depender solo del código (cada rol con su credencial, unicidad de códigos de personal). El destino de producción es Azure, que ofrece PostgreSQL Flexible Server administrado.

## Decisión

PostgreSQL 17 con TypeORM. `synchronize` apagado en todos los entornos: el esquema cambia solo con migraciones versionadas, revisadas en PR y reversibles (`down`). Las reglas críticas viven también en la base como `CHECK`, `UNIQUE` y llaves foráneas.

## Alternativas consideradas

| Opción              | A favor                                                                                                                                                          | En contra                                                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| TypeORM (elegida)   | Integración oficial con NestJS (`@nestjs/typeorm`), decoradores coherentes con el estilo de Nest, migraciones incluidas, conocido por la mayoría de equipos Nest | Tipado de consultas más débil que Prisma o Drizzle; hay que cuidar el N+1 a mano                                                         |
| Prisma              | Excelente tipado y DX, migraciones declarativas                                                                                                                  | Cliente generado aparte, `CHECK` y SQL avanzado requieren migraciones manuales igual; menos encaje con inyección de dependencias de Nest |
| Drizzle             | SQL explícito y tipado fuerte, muy liviano                                                                                                                       | Ecosistema Nest más pequeño, menos convenciones establecidas para un equipo grande                                                       |
| MongoDB             | Esquema flexible                                                                                                                                                 | Los datos son relacionales y necesitamos integridad referencial y transacciones simples                                                  |
| `synchronize: true` | Rápido al prototipar                                                                                                                                             | Puede borrar columnas en producción; el esquema deja de ser revisable                                                                    |

## Consecuencias

- Cada cambio de esquema es un archivo en `apps/api/src/database/migrations` que se revisa como cualquier código.
- Las violaciones de restricciones de la base (unique, foreign key, check) se traducen a errores HTTP claros (409, 400) en vez de 500.
- La capa de dominio de mensajes (fase 2) no depende de TypeORM: se accede por un puerto, y TypeORM queda como un adaptador reemplazable.
