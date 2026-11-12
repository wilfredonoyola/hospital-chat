import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import {
  DepartmentAccessDeniedError,
  DomainError,
  InvalidMessageError,
  UrgentNotAllowedError,
} from '../domain/errors';

function statusFor(error: DomainError): HttpStatus {
  if (error instanceof InvalidMessageError) {
    return HttpStatus.BAD_REQUEST;
  }
  if (error instanceof UrgentNotAllowedError || error instanceof DepartmentAccessDeniedError) {
    return HttpStatus.FORBIDDEN;
  }
  return HttpStatus.UNPROCESSABLE_ENTITY;
}

/** Traduce errores de dominio a HTTP. Es la única pieza que conoce ambos mundos. */
@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost): void {
    const status = statusFor(exception);
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message: exception.message });
  }
}
