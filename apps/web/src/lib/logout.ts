import { apiFetch } from './api';
import { useSession } from './session-store';

/**
 * Cierra la sesión en el servidor (revoca todos los tokens de la persona) y
 * en el navegador. La sesión local se cierra aunque la API no responda.
 */
export function logout(): void {
  void apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
  useSession.getState().signOut();
}
