import { normalizeNepalPhone } from './phone.util';

describe('normalizeNepalPhone', () => {
  it.each([
    ['9812345678', '+9779812345678'],
    ['9779812345678', '+9779812345678'],
    ['+9779812345678', '+9779812345678'],
    ['981-234-5678', '+9779812345678'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeNepalPhone(input)).toBe(expected);
  });

  it('rejects invalid numbers', () => {
    expect(() => normalizeNepalPhone('1234')).toThrow('valid Nepal mobile');
  });
});
