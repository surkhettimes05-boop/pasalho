import { toBaseQuantity } from './unit-conversion.util';

describe('toBaseQuantity', () => {
  it('converts sold quantity to base units using the product unit conversion factor', () => {
    expect(toBaseQuantity(3, 30)).toBe(90);
  });

  it('rejects zero or negative quantities', () => {
    expect(() => toBaseQuantity(0, 30)).toThrow('Quantity must be greater than zero');
    expect(() => toBaseQuantity(-1, 30)).toThrow('Quantity must be greater than zero');
  });

  it('rejects invalid conversion factors', () => {
    expect(() => toBaseQuantity(1, 0)).toThrow('Conversion factor must be greater than zero');
  });
});
