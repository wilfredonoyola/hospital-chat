import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import type { ChatMessage } from '@/features/chat/messages-cache';
import { MessageItem } from './MessageItem';

// El botón "Lo vi" usa React Query: cada prueba tiene su propio cliente.
const render = (ui: ReactElement) =>
  rtlRender(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

const base: ChatMessage = {
  id: 'm1',
  departmentId: 'emergencias',
  body: 'Cama 4 lista',
  priority: 'NORMAL',
  createdAt: '2026-11-12T08:00:00.000Z',
  author: { id: 'ana', fullName: 'Ana Martínez', role: 'STAFF' },
  seenByMe: false,
  seenCount: 0,
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

  it('pide "Lo vi" en mensajes de supervisor, salvo al propio autor', () => {
    const fromSupervisor = { ...base, author: { ...base.author, role: 'SUPERVISOR' as const } };

    const { unmount } = render(<MessageItem message={fromSupervisor} />);
    expect(screen.getByRole('button', { name: 'Lo vi' })).toBeInTheDocument();
    unmount();

    render(<MessageItem message={fromSupervisor} isMine />);
    expect(screen.queryByRole('button', { name: 'Lo vi' })).not.toBeInTheDocument();
  });

  it('muestra "Visto ✓" si ya lo había confirmado (tras recargar)', () => {
    render(
      <MessageItem
        message={{
          ...base,
          author: { ...base.author, role: 'SUPERVISOR' },
          seenByMe: true,
        }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Visto ✓' })).toBeDisabled();
  });

  it('al supervisor que lo envió le muestra cuántos lo vieron', () => {
    const mine = { ...base, author: { ...base.author, role: 'SUPERVISOR' as const } };

    const { unmount } = render(<MessageItem message={{ ...mine, seenCount: 3 }} isMine />);
    expect(screen.getByText('Visto por 3')).toBeInTheDocument();
    unmount();

    render(<MessageItem message={mine} isMine />);
    expect(screen.getByText('Nadie lo ha visto aún')).toBeInTheDocument();
  });

  it('no pide "Lo vi" en mensajes de personal', () => {
    render(<MessageItem message={base} />);

    expect(screen.queryByRole('button', { name: 'Lo vi' })).not.toBeInTheDocument();
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
