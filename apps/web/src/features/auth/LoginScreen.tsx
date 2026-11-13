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
      <LoginForm />
    </main>
  );
}
