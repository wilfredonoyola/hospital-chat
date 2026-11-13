'use client';

import type { DepartmentSummary, Role } from '@hospital-chat/shared';
import { Avatar } from './Avatar';
import type { ConnectionStatus } from './use-chat-socket';

const STATUS_LABEL = {
  connecting: 'Conectando…',
  online: 'En línea',
  offline: 'Sin conexión: reintentando',
} as const;

const ROLE_LABEL = { ADMIN: 'Admin', SUPERVISOR: 'Supervisor', STAFF: 'Personal' } as const;

interface SidebarProps {
  user: { id: string; fullName: string; role: Role };
  status: ConnectionStatus;
  departments: DepartmentSummary[];
  loading: boolean;
  activeDepartmentId: string | null;
  onSelect: (departmentId: string) => void;
  onLogout: () => void;
}

export function Sidebar({
  user,
  status,
  departments,
  loading,
  activeDepartmentId,
  onSelect,
  onLogout,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand__logo" aria-hidden="true">
          +
        </span>
        <span className="brand__name">Hospital Chat</span>
      </div>

      <nav aria-label="Áreas" className="sidebar__nav">
        <h2 className="sidebar__title">Mis áreas</h2>
        {loading && <p className="empty">Cargando…</p>}
        {!loading && departments.length === 0 && (
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
                onClick={() => onSelect(department.id)}
              >
                <span className="channel__hash" aria-hidden="true">
                  #
                </span>
                {department.name}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="user-card">
        <Avatar id={user.id} fullName={user.fullName} size={40} />
        <div className="user-card__info">
          <strong>{user.fullName}</strong>
          <span className="user-card__role">{ROLE_LABEL[user.role]}</span>
          <span className={`status status--${status}`}>{STATUS_LABEL[status]}</span>
        </div>
        <button
          type="button"
          className="sidebar__logout"
          onClick={onLogout}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </aside>
  );
}
