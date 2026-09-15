import { computeCommission, parseMoney, roundMoney } from './b2b-money.util';

describe('B2B commission math', () => {
  it('computes 10% of 1500 BYN', () => {
    expect(computeCommission('1500', '10')).toBe('150.00');
  });

  it('sums partial payments commission correctly', () => {
    const parts = [
      computeCommission('500', '10'),
      computeCommission('700', '10'),
      computeCommission('300', '10'),
    ];
    const total = parts.reduce((sum, value) => sum + parseMoney(value), 0);
    expect(roundMoney(total)).toBe('150.00');
  });

  it('does not double-count when rate is zero', () => {
    expect(computeCommission('1000', '0')).toBe('0.00');
  });
});
