import { useSession } from '@/lib/session-store';
import { useChatStore } from './chat-store';

describe('chat-store', () => {
  it('al cerrar sesión borra los borradores y el área activa (PC compartida)', () => {
    useSession.getState().signIn({
      accessToken: 'jwt',
      tokenType: 'Bearer',
      expiresIn: 1800,
      user: { id: 'ana', fullName: 'Ana Martínez', role: 'STAFF' },
    });
    useChatStore.getState().selectDepartment('emergencias');
    useChatStore.getState().setDraft('emergencias', 'Paciente de la cama 4 con…');

    useSession.getState().signOut();

    expect(useChatStore.getState()).toMatchObject({ activeDepartmentId: null, drafts: {} });
  });
});
