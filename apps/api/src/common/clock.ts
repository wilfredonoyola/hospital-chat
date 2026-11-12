/**
 * La hora se inyecta: las reglas que dependen del tiempo (bloqueo de cuenta)
 * se prueban moviendo un reloj falso, sin esperar 15 minutos reales.
 */
export abstract class Clock {
  abstract now(): Date;
}

export class SystemClock extends Clock {
  now(): Date {
    return new Date();
  }
}
