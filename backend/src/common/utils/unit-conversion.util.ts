export function toBaseQuantity(quantity: number, conversionFactor: number): number {
  if (quantity <= 0) {
    throw new Error('Quantity must be greater than zero');
  }
  if (conversionFactor <= 0) {
    throw new Error('Conversion factor must be greater than zero');
  }
  return quantity * conversionFactor;
}
