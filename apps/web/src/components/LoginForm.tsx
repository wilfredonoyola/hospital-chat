'use client';

import type { LoginResponse } from '@hospital-chat/shared';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiFetch, HttpError } from '@/lib/api';
import { useSession } from '@/lib/session-store';

/** Mensajes para el usuario. El 401 no dice si falló el código o el PIN (amenaza A2). */
function loginErrorMessage(error: unknown): string {
  if (error instanceof HttpError) {
    if (error.status === 401) return 'Código o PIN incorrectos.';
    if (error.status === 429) return 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.';
  }
  return 'No se pudo conectar. Revisa la conexión e inténtalo de nuevo.';
}

export function LoginForm() {
  const router = useRouter();
  const signIn = useSession((state) => state.signIn);
  const [staffCode, setStaffCode] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pinValid = /^\d{4,6}$/.test(pin);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!staffCode.trim() || !pinValid) {
      setError('Escribe tu código y un PIN de 4 a 6 dígitos.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const login = await apiFetch<LoginResponse>('/auth/staff/login', {
        method: 'POST',
        body: JSON.stringify({ staffCode: staffCode.trim(), pin }),
      });
      signIn(login);
      router.replace('/chat');
    } catch (loginError) {
      setError(loginErrorMessage(loginError));
      setPin('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="login" onSubmit={(event) => void onSubmit(event)} noValidate>
      <h1>Hospital Chat</h1>
      <p className="login__hint">Entra con el código de tu gafete y tu PIN.</p>

      <label>
        Código
        <input
          name="staffCode"
          autoComplete="username"
          autoCapitalize="characters"
          value={staffCode}
          onChange={(event) => setStaffCode(event.target.value.toUpperCase())}
          required
        />
      </label>

      <label>
        PIN
        <input
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          maxLength={6}
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
          required
        />
      </label>

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={submitting}>
        {submitting ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
