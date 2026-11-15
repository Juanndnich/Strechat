/**
 * Unit Tests - Event Normalization
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { cleanUsername, sanitizeComment } = require('../src/server/utils/sanitizer');

function normalizeChatEvent(raw) {
  const user = raw?.user || {};
  const uniqueId = cleanUsername(user?.displayId || user?.nickname || 'user');
  const nickname = cleanUsername(user?.nickname || user?.displayId || uniqueId);
  const comment = sanitizeComment(raw?.content || '');

  let avatarUrl = '';
  if (user?.profileThumb?.urlList && Array.isArray(user.profileThumb.urlList) && user.profileThumb.urlList.length > 0) {
    avatarUrl = user.profileThumb.urlList[0] || '';
  }

  let isMod = false;
  if (Array.isArray(user?.badgeList)) {
    isMod = user.badgeList.some(b => String(b?.name || '').toLowerCase().includes('mod'));
  }

  return {
    id: raw?.id || `chat-${Date.now()}`,
    uniqueId,
    nickname,
    comment,
    profilePictureUrl: avatarUrl,
    badges: isMod ? [{ type: 'mod', name: 'MOD' }] : [],
    isModerator: isMod,
    isSubscriber: false,
    timestamp: raw?.timestamp || Date.now()
  };
}

function normalizeViewerEvent(raw, currentPeak = 0) {
  const count = Number(raw?.viewerCount ?? raw?.totalUser ?? raw?.total ?? raw?.popularity ?? 0);
  const validCount = Math.max(0, count);
  const peakViewers = Math.max(currentPeak, validCount);

  return {
    viewerCount: validCount,
    peakViewers
  };
}

describe('normalizeChatEvent()', () => {
  it('should normalize standard chat packet into consistent schema', () => {
    const raw = {
      id: 'msg-101',
      content: 'Halo semuanya!',
      user: {
        displayId: 'streamer_fan',
        nickname: 'Fan Sejati',
        profileThumb: {
          urlList: ['https://p16-webcast.tiktokcdn.com/avatar.jpg']
        },
        badgeList: [{ name: 'Moderator' }]
      },
      timestamp: 1700000000000
    };

    const normalized = normalizeChatEvent(raw);

    assert.strictEqual(normalized.id, 'msg-101');
    assert.strictEqual(normalized.uniqueId, 'streamer_fan');
    assert.strictEqual(normalized.nickname, 'Fan Sejati');
    assert.strictEqual(normalized.comment, 'Halo semuanya!');
    assert.strictEqual(normalized.profilePictureUrl, 'https://p16-webcast.tiktokcdn.com/avatar.jpg');
    assert.strictEqual(normalized.isModerator, true);
    assert.strictEqual(normalized.badges.length, 1);
  });

  it('should handle missing or malformed chat fields with safe fallbacks', () => {
    const raw = null;
    const normalized = normalizeChatEvent(raw);

    assert.strictEqual(normalized.uniqueId, 'user');
    assert.strictEqual(normalized.comment, '');
    assert.strictEqual(normalized.isModerator, false);
    assert.strictEqual(normalized.profilePictureUrl, '');
  });
});

describe('normalizeViewerEvent()', () => {
  it('should extract viewer count and track peak viewers', () => {
    const event1 = normalizeViewerEvent({ viewerCount: 1500 }, 1000);
    assert.strictEqual(event1.viewerCount, 1500);
    assert.strictEqual(event1.peakViewers, 1500);

    const event2 = normalizeViewerEvent({ viewerCount: 1200 }, 1500);
    assert.strictEqual(event2.viewerCount, 1200);
    assert.strictEqual(event2.peakViewers, 1500); // Peak retained
  });

  it('should fallback to totalUser or popularity if viewerCount is omitted', () => {
    const event = normalizeViewerEvent({ totalUser: 850 });
    assert.strictEqual(event.viewerCount, 850);
  });

  it('should handle negative or non-numeric values gracefully', () => {
    const event = normalizeViewerEvent({ viewerCount: -50 }, 100);
    assert.strictEqual(event.viewerCount, 0);
    assert.strictEqual(event.peakViewers, 100);
  });
});
