'use client';

import { useEffect } from 'react';
import { logout } from '@/lib/logout';
import { useSession } from '@/lib/session-store';
import { Channel } from './Channel';
import { useChatStore } from './chat-store';
import { useProfile } from './queries';
import { Sidebar } from './Sidebar';
import { useChatSocket } from './use-chat-socket';

/** Pantalla del chat. La protección de sesión la pone SessionGuard en la ruta. */
export function ChatScreen() {
  const user = useSession((state) => state.user);
  const activeDepartmentId = useChatStore((state) => state.activeDepartmentId);
  const selectDepartment = useChatStore((state) => state.selectDepartment);
  const profile = useProfile();
  const { status, joinError } = useChatSocket(activeDepartmentId);

  const departments = profile.data?.departments;
  const active = departments?.find((department) => department.id === activeDepartmentId);

  // Al entrar, se abre la primera área.
  useEffect(() => {
    if (!active && departments?.length) {
      selectDepartment(departments[0].id);
    }
  }, [active, departments, selectDepartment]);

  if (!user) {
    return null;
  }

  return (
    <div className="chat">
      <Sidebar
        user={user}
        status={status}
        departments={departments ?? []}
        loading={profile.isPending}
        activeDepartmentId={activeDepartmentId}
        onSelect={selectDepartment}
        onLogout={logout}
      />
      {active ? (
        <Channel
          key={active.id}
          departmentId={active.id}
          name={active.name}
          role={user.role}
          realtimeError={joinError}
        />
      ) : (
        <main className="channel">
          <p className="empty">Elige un área.</p>
        </main>
      )}
    </div>
  );
}
