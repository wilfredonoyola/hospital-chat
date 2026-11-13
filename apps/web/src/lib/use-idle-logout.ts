'use client';

import { useEffect } from 'react';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll'] as const;

/**
 * Cierra la sesión tras un tiempo sin actividad: en la estación de
 * enfermería, quien se levanta sin cerrar sesión no deja el chat abierto
 * para el siguiente (amenaza A4).
 */
export function useIdleLogout(minutes: number, onIdle: () => void): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const restart = () => {
      clearTimeout(timer);
      timer = setTimeout(onIdle, minutes * 60_000);
    };

    restart();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, restart, { passive: true }));
    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, restart));
    };
  }, [minutes, onIdle]);
}
