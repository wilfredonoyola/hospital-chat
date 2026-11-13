'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { isSessionValid, useSession } from '@/lib/session-store';
import { LoginForm } from './LoginForm';

export function LoginScreen() {
  const router = useRouter();
  const valid = useSession(isSessionValid);

  useEffect(() => {
    if (valid) {
      router.replace('/chat');
    }
  }, [valid, router]);

  return (
    <main className="login-page">
      <section className="login-hero" aria-hidden="true">
        <div className="login-hero__content">
          <span className="brand__logo brand__logo--large">+</span>
          <h2>Comunicación clínica, en tiempo real.</h2>
          <ul>
            <li>Un canal por área: Emergencias, UCI, Farmacia…</li>
            <li>Urgentes que nadie pasa por alto.</li>
            <li>Entra con tu código y PIN desde cualquier estación.</li>
          </ul>
        </div>
      </section>
      <section className="login-panel">
        <LoginForm />
      </section>
    </main>
  );
}
