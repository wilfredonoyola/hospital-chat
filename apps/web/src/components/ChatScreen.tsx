'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { useChatStore } from '@/lib/chat-store';
import { useProfile } from '@/lib/queries';
import { isSessionValid, useSession } from '@/lib/session-store';
import { useChatSocket } from '@/lib/use-chat-socket';
import { useIdleLogout } from '@/lib/use-idle-logout';
import { Channel } from './Channel';

const IDLE_MINUTES = Number(process.env.NEXT_PUBLIC_IDLE_MINUTES ?? 10);

const STATUS_LABEL = {
  connecting: 'Conectando…',
  online: 'En línea',
  offline: 'Sin conexión: reintentando',
} as const;

export function ChatScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useSession((state) => state.user);
  const signOut = useSession((state) => state.signOut);
  // Booleano derivado: el efecto de abajo depende de él y no del objeto de
  // sesión, que cambia de identidad en cada set (y podía disparar un bucle).
  const valid = useSession(isSessionValid);
  const { activeDepartmentId, selectDepartment, reset } = useChatStore();
  const profile = useProfile();
  const status = useChatSocket(activeDepartmentId);

  const departments = profile.data?.departments ?? [];
  const active = departments.find((department) => department.id === activeDepartmentId);

  // Sin sesión válida (logout, 401, sesión vencida o revocada) se vuelve al login.
  useEffect(() => {
    if (!valid) {
      if (useSession.getState().token) {
        signOut();
      }
      reset();
      queryClient.clear();
      router.replace('/login');
    }
  }, [valid, signOut, reset, queryClient, router]);

  useEffect(() => {
    if (!active && departments.length > 0) {
      selectDepartment(departments[0].id);
    }
  }, [active, departments, selectDepartment]);

  const logout = useCallback(() => {
    // Se cierra la sesión local aunque la API no responda.
    void apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
    signOut();
  }, [signOut]);

  useIdleLogout(IDLE_MINUTES, logout);

  if (!valid || !user) {
    return null;
  }

  return (
    <div className="chat">
      <aside className="sidebar">
        <div className="sidebar__user">
          <strong>{user.fullName}</strong>
          <span className={`status status--${status}`}>{STATUS_LABEL[status]}</span>
        </div>
        <nav aria-label="Áreas">
          <h2 className="sidebar__title">Mis áreas</h2>
          {profile.isPending && <p className="empty">Cargando…</p>}
          {profile.data && departments.length === 0 && (
            <p className="empty">
              No perteneces a ningún área. Pide a un administrador que te asigne.
            </p>
          )}
          <ul>
            {departments.map((department) => (
              <li key={department.id}>
                <button
                  type="button"
                  aria-current={department.id === activeDepartmentId ? 'page' : undefined}
                  onClick={() => selectDepartment(department.id)}
                >
                  {department.name}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <button type="button" className="sidebar__logout" onClick={logout}>
          Cerrar sesión
        </button>
      </aside>

      {active ? (
        <Channel key={active.id} departmentId={active.id} name={active.name} role={user.role} />
      ) : (
        <main className="channel">
          <p className="empty">Elige un área.</p>
        </main>
      )}
    </div>
  );
}
