import { registerDecorator, ValidationOptions } from 'class-validator';

const PIN_FORMAT = /^\d{4,6}$/;
const ASCENDING = '01234567890';
const DESCENDING = '09876543210';

/**
 * Un PIN de 4 a 6 dígitos tiene poca entropía; los más comunes (1234, 0000,
 * 1111) se adivinan en los primeros intentos, antes de que el bloqueo actúe.
 */
export function pinProblem(pin: string): string | null {
  if (!PIN_FORMAT.test(pin)) {
    return 'El PIN debe tener de 4 a 6 dígitos';
  }
  if (/^(\d)\1+$/.test(pin)) {
    return 'El PIN no puede tener todos los dígitos iguales';
  }
  if (ASCENDING.includes(pin) || DESCENDING.includes(pin)) {
    return 'El PIN no puede ser una secuencia';
  }
  return null;
}

export function IsSecurePin(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyName) => {
    registerDecorator({
      name: 'isSecurePin',
      target: target.constructor,
      propertyName: propertyName as string,
      options,
      validator: {
        validate: (value: unknown) => typeof value === 'string' && pinProblem(value) === null,
        defaultMessage: (args) =>
          typeof args?.value === 'string'
            ? (pinProblem(args.value) ?? 'PIN inválido')
            : 'El PIN debe ser texto',
      },
    });
  };
}
