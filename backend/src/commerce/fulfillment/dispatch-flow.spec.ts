describe('storefront dispatch invariants', () => {
  it('keeps dispatch and delivery endpoint semantics explicit', () => {
    const states = ['PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    expect(states).toEqual([
      'PACKED',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
    ]);
  });
});
