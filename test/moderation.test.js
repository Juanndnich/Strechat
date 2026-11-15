/**
 * Unit Tests - Chat Moderation & Keyword Filter
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

function filterBannedWords(text, bannedWordsList) {
  if (!text || !Array.isArray(bannedWordsList) || bannedWordsList.length === 0) return text;
  let filtered = text;
  for (const word of bannedWordsList) {
    if (!word) continue;
    const regex = new RegExp(word.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
    filtered = filtered.replace(regex, '***');
  }
  return filtered;
}

describe('filterBannedWords()', () => {
  it('should mask banned words with asterisks case-insensitively', () => {
    const list = ['kasar', 'judi', 'spam'];
    const input = 'Jangan bicara KASAR dan promosi JUDI di sini!';
    const result = filterBannedWords(input, list);

    assert.strictEqual(result, 'Jangan bicara *** dan promosi *** di sini!');
  });

  it('should escape regex special characters in banned words safely', () => {
    const list = ['free.gift', 'win$now'];
    const input = 'Click free.gift to win$now';
    const result = filterBannedWords(input, list);

    assert.strictEqual(result, 'Click *** to ***');
  });

  it('should leave text unchanged when banned words list is empty', () => {
    const input = 'Halo semua, salam kenal!';
    const result = filterBannedWords(input, []);

    assert.strictEqual(result, input);
  });
});
