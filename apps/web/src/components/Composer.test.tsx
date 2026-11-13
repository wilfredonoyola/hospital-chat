import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useChatStore } from '@/lib/chat-store';
import { Composer } from './Composer';

describe('Composer', () => {
  beforeEach(() => useChatStore.getState().reset());

  it('solo el supervisor ve la opción de urgente', () => {
    const { rerender } = render(
      <Composer departmentId="emergencias" role="STAFF" onSend={vi.fn()} />,
    );
    expect(screen.queryByLabelText('Urgente')).not.toBeInTheDocument();

    rerender(<Composer departmentId="emergencias" role="SUPERVISOR" onSend={vi.fn()} />);
    expect(screen.getByLabelText('Urgente')).toBeInTheDocument();
  });

  it('envía con Enter, con la prioridad elegida, y limpia el campo', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<Composer departmentId="emergencias" role="SUPERVISOR" onSend={onSend} />);

    await userEvent.click(screen.getByLabelText('Urgente'));
    await userEvent.type(screen.getByLabelText('Mensaje'), 'Código azul{Enter}');

    expect(onSend).toHaveBeenCalledWith({ body: 'Código azul', priority: 'URGENT' });
    expect(screen.getByLabelText('Mensaje')).toHaveValue('');
  });

  it('no envía un mensaje vacío', async () => {
    const onSend = vi.fn();
    render(<Composer departmentId="emergencias" role="STAFF" onSend={onSend} />);

    await userEvent.type(screen.getByLabelText('Mensaje'), '   {Enter}');

    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
  });

  it('conserva el borrador de cada área al cambiar de área', async () => {
    const { rerender } = render(
      <Composer departmentId="emergencias" role="STAFF" onSend={vi.fn()} />,
    );
    await userEvent.type(screen.getByLabelText('Mensaje'), 'pendiente para emergencias');

    rerender(<Composer departmentId="uci" role="STAFF" onSend={vi.fn()} />);
    expect(screen.getByLabelText('Mensaje')).toHaveValue('');

    rerender(<Composer departmentId="emergencias" role="STAFF" onSend={vi.fn()} />);
    expect(screen.getByLabelText('Mensaje')).toHaveValue('pendiente para emergencias');
  });

  it('si el envío falla, muestra el error y devuelve el texto', async () => {
    const onSend = vi.fn().mockRejectedValue(new Error('No tienes acceso a esta área'));
    render(<Composer departmentId="emergencias" role="STAFF" onSend={onSend} />);

    await userEvent.type(screen.getByLabelText('Mensaje'), 'hola{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes acceso a esta área');
    expect(screen.getByLabelText('Mensaje')).toHaveValue('hola');
  });
});
