import { render, screen } from '@testing-library/react';
import type { ChatMessage } from '@/features/chat/messages-cache';
import { MessageItem } from './MessageItem';

const base: ChatMessage = {
  id: 'm1',
  departmentId: 'emergencias',
  body: 'Cama 4 lista',
  priority: 'NORMAL',
  createdAt: '2026-11-12T08:00:00.000Z',
  author: { id: 'ana', fullName: 'Ana Martínez', role: 'STAFF' },
};

describe('MessageItem', () => {
  it('muestra autor, rol y texto', () => {
    render(<MessageItem message={base} />);

    expect(screen.getByText('Ana Martínez')).toBeInTheDocument();
    expect(screen.getByText('Personal')).toBeInTheDocument();
    expect(screen.getByText('Cama 4 lista')).toBeInTheDocument();
    expect(screen.queryByText('Urgente')).not.toBeInTheDocument();
  });

  it('distingue un urgente a simple vista y para lectores de pantalla', () => {
    render(
      <MessageItem
        message={{
          ...base,
          priority: 'URGENT',
          author: { ...base.author, fullName: 'Carla Rivas', role: 'SUPERVISOR' },
        }}
      />,
    );

    expect(screen.getByText('Urgente')).toBeInTheDocument();
    expect(screen.getByLabelText('Mensaje urgente de Carla Rivas')).toHaveClass('message--urgent');
  });

  it('marca como "Enviando…" un mensaje optimista', () => {
    render(<MessageItem message={{ ...base, pending: true }} />);

    expect(screen.getByText('Enviando…')).toBeInTheDocument();
  });

  it('muestra el HTML de un mensaje como texto, sin ejecutarlo', () => {
    const { container } = render(
      <MessageItem message={{ ...base, body: '<img src=x onerror="alert(1)">' }} />,
    );

    expect(screen.getByText('<img src=x onerror="alert(1)">')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });
});
