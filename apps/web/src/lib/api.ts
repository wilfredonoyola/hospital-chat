import type { ApiError } from '@hospital-chat/shared';
import { useSession } from './session-store';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * fetch con el token de la sesión. Un 401 en una petición autenticada
 * significa sesión revocada o vencida: se cierra la sesión local.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useSession.getState().token;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    const message = Array.isArray(body?.message)
      ? body.message.join('. ')
      : (body?.message ?? 'Error de conexión');
    if (response.status === 401 && token) {
      useSession.getState().signOut();
    }
    throw new HttpError(response.status, message);
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}
