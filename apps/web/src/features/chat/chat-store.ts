import { create } from 'zustand';
import { useSession } from '@/lib/session-store';

interface ChatState {
  activeDepartmentId: string | null;
  /** Borrador por área: cambiar de área no pierde lo que se estaba escribiendo. */
  drafts: Record<string, string>;
  selectDepartment: (departmentId: string) => void;
  setDraft: (departmentId: string, text: string) => void;
  reset: () => void;
}

/**
 * Estado de la interfaz que no viene del servidor. Los mensajes y el perfil
 * viven en TanStack Query; aquí solo lo que el usuario está haciendo.
 */
export const useChatStore = create<ChatState>()((set) => ({
  activeDepartmentId: null,
  drafts: {},
  selectDepartment: (departmentId) => set({ activeDepartmentId: departmentId }),
  setDraft: (departmentId, text) =>
    set((state) => ({ drafts: { ...state.drafts, [departmentId]: text } })),
  reset: () => set({ activeDepartmentId: null, drafts: {} }),
}));

// Al cerrar sesión se borran los borradores: en una PC compartida, quien
// entre después en la misma pestaña no debe ver lo que escribía el anterior.
useSession.subscribe((state, previous) => {
  if (previous.token && !state.token) {
    useChatStore.getState().reset();
  }
});
