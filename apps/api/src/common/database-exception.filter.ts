import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';

interface PgError {
  code?: string;
  constraint?: string;
}

/** Mensajes para las restricciones que un usuario puede violar con datos normales. */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  users_staff_code_unique: 'Ya existe una persona con ese código',
  users_email_unique: 'Ya existe un usuario con ese email',
  departments_name_unique: 'Ya existe un área con ese nombre',
  department_members_department_fk: 'Alguna de las áreas indicadas no existe',
};

// Códigos de error de Postgres: https://www.postgresql.org/docs/current/errcodes-appendix.html
const PG_STATUS: Record<string, { status: HttpStatus; fallback: string }> = {
  '23505': { status: HttpStatus.CONFLICT, fallback: 'El registro ya existe' },
  '23503': { status: HttpStatus.BAD_REQUEST, fallback: 'Referencia a un registro inexistente' },
  '23514': { status: HttpStatus.BAD_REQUEST, fallback: 'Los datos no cumplen las reglas' },
  '22P02': { status: HttpStatus.BAD_REQUEST, fallback: 'Formato de dato inválido' },
};

/**
 * Traduce violaciones de restricciones de la base a 409/400 en lugar de 500.
 * La base es la última línea de defensa: si dos peticiones crean el mismo
 * código a la vez, la validación previa no basta y el UNIQUE decide.
 * Cualquier otro error de base sigue siendo un 500 y se registra.
 */
@Catch(QueryFailedError)
export class DatabaseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DatabaseExceptionFilter.name);

  catch(exception: QueryFailedError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { code, constraint } = exception.driverError as PgError;
    const mapped = code ? PG_STATUS[code] : undefined;

    if (!mapped) {
      this.logger.error(exception.message, exception.stack);
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error interno',
      });
      return;
    }

    response.status(mapped.status).json({
      statusCode: mapped.status,
      message: (constraint && CONSTRAINT_MESSAGES[constraint]) ?? mapped.fallback,
    });
  }
}
