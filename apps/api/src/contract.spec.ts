import type * as Contract from '@hospital-chat/shared';
import { MESSAGE_PRIORITIES, MessagePriority } from './messages/message.entity';
import { Role } from './users/role';

/**
 * Prueba de contrato entre la API y los clientes. La mayor parte se verifica
 * al compilar: los controllers devuelven los tipos de packages/shared, así que
 * un cambio incompatible rompe el build de la API o de la web.
 *
 * Aquí se cubre lo que el compilador no ve solo: que los valores que la API
 * usa en tiempo de ejecución (roles, prioridades) sean exactamente los del
 * contrato, en las dos direcciones. Si la API agrega un rol que los clientes
 * no conocen, falla el typecheck.
 */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

const roleMatches: Equals<Role, Contract.Role> = true;
const priorityMatches: Equals<MessagePriority, Contract.MessagePriority> = true;

describe('contrato API ↔ clientes (packages/shared)', () => {
  it('roles y prioridades de la API son exactamente los del contrato', () => {
    expect(roleMatches && priorityMatches).toBe(true);
    expect([...Object.values(Role)].sort()).toEqual(['ADMIN', 'STAFF', 'SUPERVISOR']);
    expect([...MESSAGE_PRIORITIES].sort()).toEqual(['NORMAL', 'URGENT']);
  });
});
