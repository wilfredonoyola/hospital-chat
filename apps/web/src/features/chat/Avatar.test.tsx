import { avatarColor, initials } from './Avatar';

describe('Avatar', () => {
  it.each([
    ['Ana Martínez', 'AM'],
    ['  carla   rivas  ', 'CR'],
    ['Luis Alberto Hernández', 'LH'],
    ['Sofía', 'S'],
    ['', '?'],
  ])('iniciales de %j → %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });

  it('el color es estable para la misma persona y varía entre personas', () => {
    expect(avatarColor('ana')).toBe(avatarColor('ana'));
    const colors = new Set(['ana', 'carla', 'luis', 'sofia', 'pedro', 'marta'].map(avatarColor));
    expect(colors.size).toBeGreaterThan(1);
  });
});
