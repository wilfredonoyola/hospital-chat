import { pinProblem } from './pin-policy';

describe('pinProblem', () => {
  it.each(['2580', '7391', '482619'])('acepta %s', (pin) => {
    expect(pinProblem(pin)).toBeNull();
  });

  it.each([
    ['123', /4 a 6 dígitos/],
    ['1234567', /4 a 6 dígitos/],
    ['12a4', /4 a 6 dígitos/],
    ['0000', /iguales/],
    ['111111', /iguales/],
    ['1234', /secuencia/],
    ['4321', /secuencia/],
    ['7890', /secuencia/],
    ['3210', /secuencia/],
  ])('rechaza %s', (pin, message) => {
    expect(pinProblem(pin)).toMatch(message);
  });
});
