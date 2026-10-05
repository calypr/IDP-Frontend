import { safeRedirect } from './safeRedirect';

describe('safeRedirect', () => {
  it.each([
    ['/', '/'],
    ['/git?tab=mine', '/git?tab=mine'],
    [undefined, '/'],
    ['https://attacker.example/steal', '/'],
    ['//attacker.example/steal', '/'],
    ['/\\attacker.example', '/'],
    ['javascript:alert(1)', '/'],
    ['/git\nLocation: https://attacker.example', '/'],
  ])('maps %s to %s', (input, expected) => {
    expect(safeRedirect(input)).toBe(expected);
  });
});
