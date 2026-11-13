'use client';

import dynamic from 'next/dynamic';

/**
 * La sesión vive en sessionStorage, que no existe en el servidor. Estas
 * pantallas se renderizan solo en el cliente para que el HTML del servidor no
 * difiera del primer render del navegador (hydration mismatch).
 */
export const ChatScreenClient = dynamic(
  () => import('./chat/ProtectedChat').then((module) => module.ProtectedChat),
  { ssr: false },
);

export const LoginScreenClient = dynamic(
  () => import('@/features/auth/LoginScreen').then((module) => module.LoginScreen),
  { ssr: false },
);
