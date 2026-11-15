/**
 * Unit Tests - Input & String Sanitizer
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { cleanUsername, escapeHtml, sanitizeComment, sanitizeGift } = require('../src/server/utils/sanitizer');

describe('cleanUsername()', () => {
  it('should trim whitespace and strip leading @ symbol', () => {
    assert.strictEqual(cleanUsername('  @streamer_pro  '), 'streamer_pro');
    assert.strictEqual(cleanUsername('@@@kickrzzz'), 'kickrzzz');
  });

  it('should remove dangerous control characters and null bytes', () => {
    assert.strictEqual(cleanUsername('user\u0000name\u001F'), 'username');
  });

  it('should return anonymous when input is empty or invalid', () => {
    assert.strictEqual(cleanUsername(''), 'anonymous');
    assert.strictEqual(cleanUsername('   '), 'anonymous');
    assert.strictEqual(cleanUsername(null), 'anonymous');
    assert.strictEqual(cleanUsername(undefined), 'anonymous');
    assert.strictEqual(cleanUsername(12345), 'anonymous');
    assert.strictEqual(cleanUsername({}), 'anonymous');
  });

  it('should truncate strings longer than 50 characters', () => {
    const longName = 'a'.repeat(80);
    const result = cleanUsername(longName);
    assert.strictEqual(result.length, 50);
  });
});

describe('escapeHtml()', () => {
  it('should escape dangerous HTML characters to prevent XSS', () => {
    const input = '<script>alert("XSS") & attack(\'test\')</script>';
    const expected = '&lt;script&gt;alert(&quot;XSS&quot;) &amp; attack(&#039;test&#039;)&lt;/script&gt;';
    assert.strictEqual(escapeHtml(input), expected);
  });

  it('should handle null, undefined, or non-string gracefully', () => {
    assert.strictEqual(escapeHtml(null), '');
    assert.strictEqual(escapeHtml(undefined), '');
    assert.strictEqual(escapeHtml(123), '123');
  });
});

describe('sanitizeComment()', () => {
  it('should sanitize HTML tags while preserving normal text and emojis', () => {
    const input = '<b>Keren</b> banget bang! 👍✨';
    const result = sanitizeComment(input);
    assert.strictEqual(result.includes('<b>'), false);
    assert.strictEqual(result.includes('&lt;b&gt;Keren&lt;/b&gt;'), true);
    assert.strictEqual(result.includes('👍✨'), true);
  });

  it('should strip null bytes and control characters', () => {
    const input = 'Halo\u0000 Dunia\u0007!';
    const result = sanitizeComment(input);
    assert.strictEqual(result, 'Halo Dunia!');
  });

  it('should truncate comments longer than 500 characters', () => {
    const longText = 'k'.repeat(600);
    const result = sanitizeComment(longText);
    assert.strictEqual(result.length, 500);
  });

  it('should return empty string for non-string input', () => {
    assert.strictEqual(sanitizeComment(null), '');
    assert.strictEqual(sanitizeComment(undefined), '');
  });
});

describe('sanitizeGift()', () => {
  it('should sanitize valid gift payload correctly', () => {
    const raw = {
      giftId: '5655',
      giftName: '<Rose>',
      diamondCount: '1',
      repeatCount: '5',
      repeatEnd: 1,
      giftPictureUrl: 'https://p16-webcast.tiktokcdn.com/gift.png'
    };
    const sanitized = sanitizeGift(raw);
    assert.strictEqual(sanitized.giftId, 5655);
    assert.strictEqual(sanitized.giftName, '&lt;Rose&gt;');
    assert.strictEqual(sanitized.diamondCount, 1);
    assert.strictEqual(sanitized.repeatCount, 5);
    assert.strictEqual(sanitized.repeatEnd, true);
    assert.strictEqual(sanitized.giftPictureUrl, 'https://p16-webcast.tiktokcdn.com/gift.png');
  });

  it('should reject non-http picture URLs', () => {
    const raw = {
      giftId: 1,
      giftPictureUrl: 'javascript:alert(1)'
    };
    const sanitized = sanitizeGift(raw);
    assert.strictEqual(sanitized.giftPictureUrl, '');
  });

  it('should handle invalid or null gift object safely', () => {
    assert.strictEqual(sanitizeGift(null), null);
    assert.strictEqual(sanitizeGift(undefined), null);
    assert.strictEqual(sanitizeGift('invalid'), null);
  });
});
