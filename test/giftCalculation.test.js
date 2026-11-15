/**
 * Unit Tests - Gift & Diamond Calculations
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

function calculateGiftDiamonds(diamondUnit, repeatCount, isStreakEnd) {
  const diamondsPerUnit = Math.max(0, Number(diamondUnit) || 0);
  const count = Math.max(1, Number(repeatCount) || 1);
  const isOver = Boolean(isStreakEnd);

  // When combo is finished (repeatEnd = true), diamonds are unit * total repeatCount
  // When combo is in progress, intermediate update accounts for unit * 1
  return diamondsPerUnit * (isOver ? count : 1);
}

function aggregateSessionDiamonds(currentTotal, incomingDiamonds) {
  const base = Math.max(0, Number(currentTotal) || 0);
  const addition = Math.max(0, Number(incomingDiamonds) || 0);
  return base + addition;
}

describe('calculateGiftDiamonds()', () => {
  it('should calculate diamonds for single gift', () => {
    const diamonds = calculateGiftDiamonds(1, 1, true);
    assert.strictEqual(diamonds, 1);
  });

  it('should calculate diamonds for combo gift streak when combo ends', () => {
    // 5 Rose gifts (1 diamond each)
    const diamonds = calculateGiftDiamonds(1, 5, true);
    assert.strictEqual(diamonds, 5);

    // 10 Galaxy gifts (1000 diamonds each)
    const galaxyTotal = calculateGiftDiamonds(1000, 10, true);
    assert.strictEqual(galaxyTotal, 10000);
  });

  it('should calculate unit diamond when combo streak is still ongoing', () => {
    const intermediate = calculateGiftDiamonds(1, 5, false);
    assert.strictEqual(intermediate, 1);
  });

  it('should handle zero, negative, or invalid counts gracefully', () => {
    assert.strictEqual(calculateGiftDiamonds(0, 10, true), 0);
    assert.strictEqual(calculateGiftDiamonds(-5, 10, true), 0);
    assert.strictEqual(calculateGiftDiamonds(10, 0, true), 10); // Minimum repeatCount is 1
    assert.strictEqual(calculateGiftDiamonds(10, -3, true), 10);
    assert.strictEqual(calculateGiftDiamonds('not_a_number', 5, true), 0);
    assert.strictEqual(calculateGiftDiamonds(10, 'invalid', true), 10);
  });
});

describe('aggregateSessionDiamonds()', () => {
  it('should accumulate total diamonds across multiple gifts', () => {
    let sessionDiamonds = 0;
    sessionDiamonds = aggregateSessionDiamonds(sessionDiamonds, 10);
    sessionDiamonds = aggregateSessionDiamonds(sessionDiamonds, 50);
    sessionDiamonds = aggregateSessionDiamonds(sessionDiamonds, 200);

    assert.strictEqual(sessionDiamonds, 260);
  });

  it('should handle invalid values without corrupting total', () => {
    let sessionDiamonds = 100;
    sessionDiamonds = aggregateSessionDiamonds(sessionDiamonds, null);
    sessionDiamonds = aggregateSessionDiamonds(sessionDiamonds, undefined);
    sessionDiamonds = aggregateSessionDiamonds(sessionDiamonds, -50);

    assert.strictEqual(sessionDiamonds, 100);
  });
});
