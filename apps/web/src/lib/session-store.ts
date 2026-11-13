import type { LoginResponse } from '@hospital-chat/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface SessionState {
  token: string | null;
  user: LoginResponse['user'] | null;
  /** Epoch en milisegundos. */
  expiresAt: number | null;
  signIn: (login: LoginResponse) => void;
  signOut: () => void;
}

/**
 * Sesión en sessionStorage, no en localStorage: se borra al cerrar la
 * pestaña, que es lo esperable en una PC compartida (amenaza A4). El riesgo
 * de XSS y por qué no es una cookie httpOnly está en el ADR 0005.
 */
export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      expiresAt: null,
      signIn: (login) =>
        set({
          token: login.accessToken,
          user: login.user,
          expiresAt: Date.now() + login.expiresIn * 1000,
        }),
      signOut: () => set({ token: null, user: null, expiresAt: null }),
    }),
    {
      name: 'hospital-chat-session',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);

export function isSessionValid(state: Pick<SessionState, 'token' | 'expiresAt'>): boolean {
  return !!state.token && !!state.expiresAt && state.expiresAt > Date.now();
}
