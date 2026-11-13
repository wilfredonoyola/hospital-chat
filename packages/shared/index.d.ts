/**
 * Contrato entre la API y los clientes (web y móvil): la forma de los datos
 * tal como viajan por la red. Las fechas son strings ISO porque JSON no tiene
 * fechas.
 *
 * Es un archivo de declaraciones (.d.ts): solo tipos, sin código que
 * compilar ni publicar. Si la API cambia un campo, la web deja de compilar.
 */

export type Role = 'ADMIN' | 'SUPERVISOR' | 'STAFF';

export type MessagePriority = 'NORMAL' | 'URGENT';

export interface DepartmentSummary {
  id: string;
  name: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  role: Role;
  staffCode: string | null;
  email: string | null;
  isActive: boolean;
  departments: DepartmentSummary[];
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  /** Segundos de vida del token. */
  expiresIn: number;
  user: { id: string; fullName: string; role: Role };
}

export interface MessageView {
  id: string;
  departmentId: string;
  body: string;
  priority: MessagePriority;
  /** ISO 8601 */
  createdAt: string;
  author: { id: string; fullName: string; role: Role };
}

/** Una página del canal, del más reciente al más antiguo. */
export interface MessagePage {
  items: MessageView[];
  /** Para pedir la página anterior (`?before=`). null si no hay más. */
  nextCursor: string | null;
}

export interface SendMessageRequest {
  body: string;
  priority?: MessagePriority;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
}

export type JoinResult = { ok: true } | { ok: false; message: string };

/** Eventos que el servidor emite al cliente. */
export interface ServerToClientEvents {
  'message:new': (message: MessageView) => void;
  'session:invalid': (reason: string) => void;
}

/** Eventos que el cliente emite al servidor (con acknowledgement). */
export interface ClientToServerEvents {
  'department:join': (data: { departmentId: string }, ack: (result: JoinResult) => void) => void;
  'department:leave': (data: { departmentId: string }, ack: (result: JoinResult) => void) => void;
}
