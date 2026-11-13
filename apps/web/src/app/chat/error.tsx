'use client';

/**
 * Límite de error de la ruta /chat (convención de App Router): un error de
 * render no deja la pantalla en blanco, y se puede reintentar sin perder la
 * sesión.
 */
export default function ChatError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="login-page">
      <div className="login" role="alert">
        <h1>Algo salió mal</h1>
        <p className="login__hint">
          El chat tuvo un problema al mostrarse. Tu sesión sigue abierta.
        </p>
        <button type="button" onClick={reset}>
          Reintentar
        </button>
      </div>
    </main>
  );
}
