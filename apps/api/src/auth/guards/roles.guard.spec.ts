import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../users/role';
import { AuthUser } from '../auth-user';
import { RolesGuard } from './roles.guard';

function contextFor(user: AuthUser | undefined): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  afterEach(() => jest.restoreAllMocks());

  function requireRoles(roles: Role[] | undefined) {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);
  }

  it('deja pasar cuando el endpoint no exige rol', () => {
    requireRoles(undefined);

    expect(guard.canActivate(contextFor({ id: 'u', role: Role.STAFF }))).toBe(true);
  });

  it('deja pasar cuando el rol del usuario está entre los exigidos', () => {
    requireRoles([Role.ADMIN, Role.SUPERVISOR]);

    expect(guard.canActivate(contextFor({ id: 'u', role: Role.SUPERVISOR }))).toBe(true);
  });

  it('responde 403 cuando el rol no alcanza', () => {
    requireRoles([Role.ADMIN]);

    expect(() => guard.canActivate(contextFor({ id: 'u', role: Role.STAFF }))).toThrow(
      ForbiddenException,
    );
  });

  it('responde 403 si por error llega sin usuario: nunca abre por defecto', () => {
    requireRoles([Role.ADMIN]);

    expect(() => guard.canActivate(contextFor(undefined))).toThrow(ForbiddenException);
  });
});
