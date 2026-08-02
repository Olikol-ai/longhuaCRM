import { SESSION_STATUS } from '../constants';
import {
  resolvePreparationDisplayStatus,
  shouldAppearInPreparationHistory,
} from '../utils/preparation-history';

describe('preparation-history utils', () => {
  it('hides sessions without engagement', () => {
    expect(
      shouldAppearInPreparationHistory({
        status: SESSION_STATUS.InProgress,
        hasEngagement: false,
      }),
    ).toBe(false);
    expect(
      shouldAppearInPreparationHistory({
        status: SESSION_STATUS.Completed,
        hasEngagement: false,
      }),
    ).toBe(false);
  });

  it('shows engaged in_progress / completed / expired', () => {
    expect(
      shouldAppearInPreparationHistory({
        status: SESSION_STATUS.InProgress,
        hasEngagement: true,
      }),
    ).toBe(true);
    expect(
      shouldAppearInPreparationHistory({
        status: SESSION_STATUS.Completed,
        hasEngagement: true,
      }),
    ).toBe(true);
    expect(
      shouldAppearInPreparationHistory({
        status: SESSION_STATUS.Expired,
        hasEngagement: true,
      }),
    ).toBe(true);
  });

  it('hides draft ready cancelled even with engagement', () => {
    expect(
      shouldAppearInPreparationHistory({
        status: SESSION_STATUS.Draft,
        hasEngagement: true,
      }),
    ).toBe(false);
    expect(
      shouldAppearInPreparationHistory({
        status: SESSION_STATUS.Cancelled,
        hasEngagement: true,
      }),
    ).toBe(false);
  });

  it('maps timeout completed to expired display', () => {
    expect(
      resolvePreparationDisplayStatus({
        status: SESSION_STATUS.Completed,
        submitReason: 'timeout',
      }),
    ).toBe(SESSION_STATUS.Expired);
    expect(
      resolvePreparationDisplayStatus({
        status: SESSION_STATUS.Completed,
        submitReason: 'manual',
      }),
    ).toBe(SESSION_STATUS.Completed);
    expect(
      resolvePreparationDisplayStatus({
        status: SESSION_STATUS.InProgress,
        submitReason: null,
      }),
    ).toBe(SESSION_STATUS.InProgress);
  });
});
