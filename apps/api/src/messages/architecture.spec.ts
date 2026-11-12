import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Prueba de arquitectura (fitness function): la regla de dependencias del
 * ADR 0004 se verifica en cada PR, no solo en la revisión de código.
 */
function importsIn(layer: string): Array<{ file: string; source: string }> {
  const dir = join(__dirname, layer);
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .flatMap((file) =>
      [...readFileSync(join(dir, file), 'utf8').matchAll(/from '([^']+)'/g)].map((match) => ({
        file: `${layer}/${file}`,
        source: match[1],
      })),
    );
}

describe('Arquitectura del módulo de mensajes', () => {
  it('el dominio no depende de NestJS, TypeORM ni de otras capas', () => {
    const forbidden = importsIn('domain').filter(({ source }) =>
      /^@nestjs|^typeorm|\/(application|infrastructure|http)\//.test(source),
    );

    expect(forbidden).toEqual([]);
  });

  it('la aplicación no depende de TypeORM ni de la infraestructura', () => {
    // @nestjs/cqrs sí se permite: sus decoradores registran los handlers. Es
    // una concesión pragmática; los handlers se prueban igual sin NestJS.
    const forbidden = importsIn('application').filter(({ source }) =>
      /^typeorm|^@nestjs\/typeorm|\/(infrastructure|http)\//.test(source),
    );

    expect(forbidden).toEqual([]);
  });
});
