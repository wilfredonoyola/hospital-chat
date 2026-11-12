/**
 * Errores del dominio. No saben nada de HTTP: la capa http/ decide que
 * InvalidMessageError es un 400 y los demás un 403. Así el dominio se puede
 * usar igual desde un worker, un socket o una prueba.
 */
export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidMessageError extends DomainError {}

export class UrgentNotAllowedError extends DomainError {
  constructor() {
    super('Solo un supervisor puede enviar mensajes urgentes');
  }
}

/** Mismo error si el área no existe, está inactiva o no pertenece a ella: no se revela cuál. */
export class DepartmentAccessDeniedError extends DomainError {
  constructor() {
    super('No tienes acceso a esta área');
  }
}
