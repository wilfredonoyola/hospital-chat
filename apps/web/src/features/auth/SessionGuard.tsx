'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { logout } from '@/lib/logout';
import { isSessionValid, useSession } from '@/lib/session-store';
import { useIdleLogout } from './use-idle-logout';

const IDLE_MINUTES = Number(process.env.NEXT_PUBLIC_IDLE_MINUTES ?? 10);

/**
 * Protege una pantalla: sin sesión válida (logout, 401, vencida o revocada)
 * vuelve al login y vacía la caché de datos. Cierra la sesión tras un tiempo
 * sin actividad (PC compartida, amenaza A4).
 *
 * Es protección del lado del cliente porque el token vive en sessionStorage;
 * la evolución con cookie httpOnly y proxy.ts está en el ADR 0006.
 */
export function SessionGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  // Booleano derivado: el efecto depende de él y no del objeto de sesión,
  // que cambia de identidad en cada set (y podía disparar un bucle).
  const valid = useSession(isSessionValid);

  useEffect(() => {
    if (!valid) {
      if (useSession.getState().token) {
        useSession.getState().signOut();
      }
      queryClient.clear();
      router.replace('/login');
    }
  }, [valid, queryClient, router]);

  useIdleLogout(IDLE_MINUTES, logout);

  return valid ? children : null;
}
