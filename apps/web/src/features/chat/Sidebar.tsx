'use client';

import type { DepartmentSummary } from '@hospital-chat/shared';
import type { ConnectionStatus } from './use-chat-socket';

const STATUS_LABEL = {
  connecting: 'Conectando…',
  online: 'En línea',
  offline: 'Sin conexión: reintentando',
} as const;

interface SidebarProps {
  fullName: string;
  status: ConnectionStatus;
  departments: DepartmentSummary[];
  loading: boolean;
  activeDepartmentId: string | null;
  onSelect: (departmentId: string) => void;
  onLogout: () => void;
}

export function Sidebar({
  fullName,
  status,
  departments,
  loading,
  activeDepartmentId,
  onSelect,
  onLogout,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__user">
        <strong>{fullName}</strong>
        <span className={`status status--${status}`}>{STATUS_LABEL[status]}</span>
      </div>
      <nav aria-label="Áreas">
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
                {department.name}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <button type="button" className="sidebar__logout" onClick={onLogout}>
        Cerrar sesión
      </button>
    </aside>
  );
}
