import { ArgumentsHost, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { DatabaseExceptionFilter } from './database-exception.filter';

function pgError(driverError: object) {
  return new QueryFailedError('INSERT ...', [], driverError as Error);
}

function run(exception: QueryFailedError) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;

  new DatabaseExceptionFilter().catch(exception, host);

  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
}

describe('DatabaseExceptionFilter', () => {
  it('traduce un UNIQUE conocido a 409 con un mensaje claro', () => {
    const result = run(pgError({ code: '23505', constraint: 'users_staff_code_unique' }));

    expect(result.status).toBe(409);
    expect(result.body.message).toBe('Ya existe una persona con ese código');
  });

  it('traduce una llave foránea a 400', () => {
    const result = run(pgError({ code: '23503', constraint: 'department_members_department_fk' }));

    expect(result.status).toBe(400);
    expect(result.body.message).toBe('Alguna de las áreas indicadas no existe');
  });

  it('usa un mensaje genérico para restricciones sin traducción', () => {
    const result = run(pgError({ code: '23514', constraint: 'users_credentials_match_role' }));

    expect(result.status).toBe(400);
    expect(result.body.message).toBe('Los datos no cumplen las reglas');
  });

  it('no expone el error de la base cuando no es una restricción, pero lo registra', () => {
    const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const exception = pgError({ code: 'XX000' });
    exception.message = 'canceling statement due to timeout';

    const result = run(exception);

    expect(result.status).toBe(500);
    expect(JSON.stringify(result.body)).not.toMatch(/statement/);
    expect(logError).toHaveBeenCalledWith('canceling statement due to timeout', exception.stack);
    logError.mockRestore();
  });

  it('una consulta cancelada por statement_timeout responde 503 (reintentable)', () => {
    const result = run(pgError({ code: '57014' }));

    expect(result.status).toBe(503);
    expect(result.body.message).toMatch(/Inténtalo de nuevo/);
  });
});
