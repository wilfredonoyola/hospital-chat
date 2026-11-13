import { renderHook } from '@testing-library/react';
import { useIdleLogout } from './use-idle-logout';

describe('useIdleLogout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('cierra la sesión tras los minutos sin actividad', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleLogout(10, onIdle));

    vi.advanceTimersByTime(10 * 60_000 - 1);
    expect(onIdle).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledOnce();
  });

  it('cualquier actividad reinicia la cuenta', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleLogout(10, onIdle));

    vi.advanceTimersByTime(9 * 60_000);
    window.dispatchEvent(new KeyboardEvent('keydown'));
    vi.advanceTimersByTime(9 * 60_000);

    expect(onIdle).not.toHaveBeenCalled();
  });
});
