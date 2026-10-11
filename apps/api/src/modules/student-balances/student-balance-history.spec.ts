import {
  buildBalanceHistoryFromLedger,
  mapLedgerEntryToHistoryItem,
  sortBalanceHistoryAsc,
} from './student-balance-history';

describe('student-balance-history', () => {
  it('maps credit + debit without dropping rows (Test 1)', () => {
    const history = buildBalanceHistoryFromLedger([
      {
        id: 'c1',
        delta: 10,
        operationType: 'credit',
        sourceType: 'payment',
        sourceId: '11111111-1111-4111-8111-111111111111',
        description: 'payment pack',
        createdAt: '2026-08-15T18:30:00.000Z',
      },
      {
        id: 'd1',
        delta: -1,
        operationType: 'debit',
        sourceType: 'lesson',
        sourceId: '22222222-2222-4222-8222-222222222222',
        description: 'completed',
        createdAt: '2026-08-16T17:00:00.000Z',
      },
      {
        id: 'c2',
        delta: 4,
        operationType: 'credit',
        sourceType: 'payment',
        sourceId: '33333333-3333-4333-8333-333333333333',
        createdAt: '2026-09-01T12:00:00.000Z',
      },
      {
        id: 'd2',
        delta: -1,
        operationType: 'debit',
        sourceType: 'lesson',
        sourceId: '44444444-4444-4444-8444-444444444444',
        description: 'missed_no_notice',
        createdAt: '2026-09-03T17:00:00.000Z',
      },
    ]);

    expect(history).toHaveLength(4);
    expect(history.map((h) => h.type)).toEqual([
      'credit',
      'debit',
      'credit',
      'debit',
    ]);
    expect(history.map((h) => h.delta)).toEqual([10, -1, 4, -1]);
    expect(history[0].label).toBe('Пополнение');
    expect(history[1].label).toBe('Списание');
    expect(history[1].lesson_id).toBe('22222222-2222-4222-8222-222222222222');
    expect(history[0].payment_id).toBe('11111111-1111-4111-8111-111111111111');
    expect(history.every((h) => h.amount === null)).toBe(true);
  });

  it('sorts chronologically ASC by movement_at (Test 2)', () => {
    const scrambled = buildBalanceHistoryFromLedger([
      { id: 'a', delta: 1, operationType: 'credit', sourceType: 'payment', createdAt: '2026-09-10T10:00:00.000Z' },
      { id: 'b', delta: -1, operationType: 'debit', sourceType: 'lesson', createdAt: '2026-08-01T10:00:00.000Z' },
      { id: 'c', delta: -1, operationType: 'debit', sourceType: 'lesson', createdAt: '2026-10-25T10:00:00.000Z' },
      { id: 'd', delta: 1, operationType: 'credit', sourceType: 'payment', createdAt: '2026-08-15T10:00:00.000Z' },
      { id: 'e', delta: -1, operationType: 'debit', sourceType: 'lesson', createdAt: '2026-09-03T10:00:00.000Z' },
    ]);

    expect(scrambled.map((h) => h.date)).toEqual([
      '2026-08-01',
      '2026-08-15',
      '2026-09-03',
      '2026-09-10',
      '2026-10-25',
    ]);
  });

  it('uses stable secondary key when timestamps match (Test 3)', () => {
    const sameTs = '2026-08-16T12:00:00.000Z';
    const sorted = sortBalanceHistoryAsc([
      mapLedgerEntryToHistoryItem({
        id: 'bbb',
        delta: -1,
        operationType: 'debit',
        sourceType: 'lesson',
        createdAt: sameTs,
      }),
      mapLedgerEntryToHistoryItem({
        id: 'aaa',
        delta: 5,
        operationType: 'credit',
        sourceType: 'payment',
        createdAt: sameTs,
      }),
    ]);

    expect(sorted.map((h) => h.id)).toEqual(['aaa', 'bbb']);
  });

  it('keeps interleaved types in one timeline (Test 4)', () => {
    const history = buildBalanceHistoryFromLedger([
      { id: '1', delta: 8, operationType: 'credit', sourceType: 'payment', createdAt: '2026-08-01T10:00:00.000Z' },
      { id: '2', delta: -1, operationType: 'debit', sourceType: 'lesson', createdAt: '2026-08-02T10:00:00.000Z' },
      { id: '3', delta: 4, operationType: 'credit', sourceType: 'payment', createdAt: '2026-08-03T10:00:00.000Z' },
      { id: '4', delta: -1, operationType: 'debit', sourceType: 'lesson', createdAt: '2026-08-04T10:00:00.000Z' },
      { id: '5', delta: -1, operationType: 'debit', sourceType: 'attendance', createdAt: '2026-08-05T10:00:00.000Z' },
      { id: '6', delta: 10, operationType: 'credit', sourceType: 'payment', createdAt: '2026-08-06T10:00:00.000Z' },
    ]);

    expect(history.map((h) => h.type)).toEqual([
      'credit',
      'debit',
      'credit',
      'debit',
      'debit',
      'credit',
    ]);
    // Must NOT group all credits first
    expect(history.map((h) => h.type).join(',')).not.toBe(
      'credit,credit,credit,debit,debit,debit',
    );
  });

  it('Arsentiy-style mixed ledger returns all four movements (Test 5)', () => {
    // Models real Arsentiy pattern: credits + contact-lesson debits in ledger
    const history = buildBalanceHistoryFromLedger([
      {
        id: 'ars-c1',
        delta: 4,
        operationType: 'credit',
        sourceType: 'payment',
        createdAt: '2026-08-12T15:31:17.709Z',
      },
      {
        id: 'ars-d1',
        delta: -1,
        operationType: 'debit',
        sourceType: 'lesson',
        createdAt: '2026-08-14T11:00:00.077Z',
      },
      {
        id: 'ars-d2',
        delta: -1,
        operationType: 'debit',
        sourceType: 'lesson',
        createdAt: '2026-08-21T11:00:00.074Z',
      },
      {
        id: 'ars-c2',
        delta: 4,
        operationType: 'credit',
        sourceType: 'payment',
        createdAt: '2026-09-11T08:10:41.206Z',
      },
    ]);

    expect(history).toHaveLength(4);
    expect(history.filter((h) => h.type === 'credit')).toHaveLength(2);
    expect(history.filter((h) => h.type === 'debit')).toHaveLength(2);
    expect(history.map((h) => h.id)).toEqual([
      'ars-c1',
      'ars-d1',
      'ars-d2',
      'ars-c2',
    ]);
  });

  it('Freon/Sofya-style multi-month scramble sorts correctly (Test 6)', () => {
    const history = buildBalanceHistoryFromLedger([
      { id: 's-sep', delta: -1, operationType: 'debit', sourceType: 'attendance', createdAt: '2026-09-14T14:00:00.000Z' },
      { id: 's-oct', delta: -1, operationType: 'debit', sourceType: 'lesson', createdAt: '2026-10-03T12:00:00.000Z' },
      { id: 's-aug-pay', delta: 8, operationType: 'credit', sourceType: 'payment', createdAt: '2026-08-16T13:10:16.000Z' },
      { id: 's-sep2', delta: -1, operationType: 'debit', sourceType: 'attendance', createdAt: '2026-09-07T14:00:00.000Z' },
      { id: 's-aug-d', delta: -1, operationType: 'debit', sourceType: 'attendance', createdAt: '2026-08-06T08:30:00.000Z' },
      { id: 's-oct2', delta: 1, operationType: 'adjustment', sourceType: 'adjustment', createdAt: '2026-10-01T09:00:00.000Z' },
    ]);

    expect(history.map((h) => h.id)).toEqual([
      's-aug-d',
      's-aug-pay',
      's-sep2',
      's-sep',
      's-oct2',
      's-oct',
    ]);
    expect(history.map((h) => h.date.slice(5, 7))).toEqual([
      '08',
      '08',
      '09',
      '09',
      '10',
      '10',
    ]);
  });
});
