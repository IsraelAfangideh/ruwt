// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { stashVersusReturn, consumeVersusReturn } from './return-after-login';

describe('versus return-after-login', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('round-trips a Versus arena route', () => {
    stashVersusReturn('fizzbuzz-budget');
    expect(consumeVersusReturn()).toEqual({
      name: 'Arena',
      params: { challengeId: 'fizzbuzz-budget', playMode: 'versus' },
    });
    expect(consumeVersusReturn()).toBeNull();
  });

  it('returns null when nothing was stashed', () => {
    expect(consumeVersusReturn()).toBeNull();
  });

  it('ignores empty challenge ids', () => {
    stashVersusReturn('');
    expect(consumeVersusReturn()).toBeNull();
  });
});
