import { describe, expect, it } from 'vitest';
import { canChange, canMove, insertionAfterLock, moveRefusal } from './programLock';

describe('a program with locked lines', () => {
  it('lets only the lines under the locked ones be changed', () => {
    expect(canChange(0, 2)).toBe(false);
    expect(canChange(1, 2)).toBe(false);
    expect(canChange(2, 2)).toBe(true);
  });

  it('moves no locked line, and no line in among them', () => {
    expect(canMove(0, 3, 2)).toBe(false);
    expect(canMove(3, 1, 2)).toBe(false);
    expect(canMove(3, 2, 2)).toBe(true);
    expect(canMove(2, 4, 2)).toBe(true);
  });

  it('says why a move was refused', () => {
    expect(moveRefusal(0, 2)).toBe('L0 is given by the challenge: it stays where it is');
    expect(moveRefusal(2, 2)).toBe('L2 cannot move in among the lines the challenge gives');
  });

  it('puts new lines under the locked ones at the highest', () => {
    expect(insertionAfterLock(0, 2)).toBe(2);
    expect(insertionAfterLock(1, 2)).toBe(2);
    expect(insertionAfterLock(3, 2)).toBe(3);
    expect(insertionAfterLock(null, 2)).toBeNull();
  });

  it('locks nothing when no line is locked', () => {
    expect(canChange(0, 0)).toBe(true);
    expect(canMove(1, 0, 0)).toBe(true);
    expect(insertionAfterLock(0, 0)).toBe(0);
  });
});
