const { describe, it } = require('node:test');
const assert = require('node:assert');
const tikTokService = require('../src/server/tiktokService');

describe('Overlay Studio Configuration & Sanitization', () => {
  const SAFE_FONTS = ['Poppins', 'Montserrat', 'Roboto', 'Inter', 'Bangers', 'Ubuntu'];
  const VALID_ANIMATIONS = ['pop', 'slide', 'fade', 'bounce'];
  const THEME_NAMES = ['pixel', 'classic', 'pill', 'glass', 'neon', 'borderless'];

  function parseOverlayParams(paramsObj) {
    const theme = THEME_NAMES.includes(paramsObj.theme) ? paramsObj.theme : 'pixel';
    const font = SAFE_FONTS.includes(paramsObj.font) ? paramsObj.font : 'Poppins';
    const anim = VALID_ANIMATIONS.includes(paramsObj.anim) ? paramsObj.anim : 'pop';
    const rawSize = parseInt(paramsObj.size, 10);
    const size = isNaN(rawSize) ? 13 : Math.min(24, Math.max(10, rawSize));
    const rawFade = parseInt(paramsObj.fade, 10);
    const fade = isNaN(rawFade) || rawFade < 0 ? 12 : Math.min(60, rawFade);
    const hideAvatar = paramsObj.hideAvatar === 'true' || paramsObj.hideAvatar === '1';
    const hideBadges = paramsObj.hideBadges === 'true' || paramsObj.hideBadges === '1';

    return { theme, font, anim, size, fade, hideAvatar, hideBadges };
  }

  it('should parse valid overlay query parameters correctly', () => {
    const config = parseOverlayParams({
      theme: 'pixel',
      font: 'Montserrat',
      anim: 'slide',
      size: '15',
      fade: '8',
      hideAvatar: 'true',
      hideBadges: 'false'
    });

    assert.strictEqual(config.theme, 'pixel');
    assert.strictEqual(config.font, 'Montserrat');
    assert.strictEqual(config.anim, 'slide');
    assert.strictEqual(config.size, 15);
    assert.strictEqual(config.fade, 8);
    assert.strictEqual(config.hideAvatar, true);
    assert.strictEqual(config.hideBadges, false);
  });

  it('should safely fallback when given malicious, unknown, or malformed inputs', () => {
    const config = parseOverlayParams({
      theme: '<script>alert(1)</script>',
      font: 'MaliciousFontUrl',
      anim: 'drop-bomb',
      size: '999999',
      fade: '-50',
      hideAvatar: 'undefined',
      hideBadges: null
    });

    assert.strictEqual(config.theme, 'pixel');
    assert.strictEqual(config.font, 'Poppins');
    assert.strictEqual(config.anim, 'pop');
    assert.strictEqual(config.size, 24); // clamped to max 24
    assert.strictEqual(config.fade, 12); // fallback
    assert.strictEqual(config.hideAvatar, false);
    assert.strictEqual(config.hideBadges, false);
  });
});

describe('Streamer Profiles Management Logic', () => {
  function processProfileAdd(existingList, rawInput) {
    const cleaned = (rawInput || '').trim().replace(/^@+/, '');
    if (!cleaned) return existingList;
    const list = [...existingList];
    if (!list.includes(cleaned)) {
      list.unshift(cleaned);
      if (list.length > 20) list.pop();
    }
    return list;
  }

  it('should strip leading @ and add profile to list', () => {
    let profiles = [];
    profiles = processProfileAdd(profiles, '@streamer_kece');
    assert.deepStrictEqual(profiles, ['streamer_kece']);
  });

  it('should prevent duplicate profiles and keep unique items', () => {
    let profiles = ['streamer_kece', 'gamer_pro'];
    profiles = processProfileAdd(profiles, 'streamer_kece');
    assert.strictEqual(profiles.length, 2);
  });

  it('should clamp max profiles to 20', () => {
    let profiles = [];
    for (let i = 1; i <= 25; i++) {
      profiles = processProfileAdd(profiles, `streamer_${i}`);
    }
    assert.strictEqual(profiles.length, 20);
    assert.strictEqual(profiles[0], 'streamer_25');
  });
});

describe('TikTok Service Privacy and Token Isolation', () => {
  it('getStatus() must NEVER expose sessionId or credential tokens', () => {
    tikTokService.options = { sessionId: 'secret_tiktok_session_token_12345' };
    const status = tikTokService.getStatus();

    assert.strictEqual(status.status, 'DISCONNECTED');
    assert.strictEqual(status.options, undefined);
    assert.strictEqual(status.sessionId, undefined);
    assert.strictEqual(status.stats.sessionId, undefined);
    assert.strictEqual(JSON.stringify(status).includes('secret_tiktok_session_token_12345'), false);
  });

  it('checkLiveStatus() should safely validate username and handle offline status without crashing', async () => {
    const invalidResult = await tikTokService.checkLiveStatus('');
    assert.strictEqual(invalidResult.isLive, false);
    assert.strictEqual(invalidResult.error, 'Username tidak valid');

    const offlineResult = await tikTokService.checkLiveStatus('streamer_tidak_ditemukan_xyz_999');
    assert.strictEqual(offlineResult.isLive, false);
  });
});
