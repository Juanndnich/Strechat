/**
 * Unit Tests - Live Session & Analytics Service (P4)
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const sessionService = require('../src/server/sessionService');

describe('SessionService Live Analytics', () => {
  it('should start a session and record viewer metrics & peak calculation', () => {
    sessionService.startSession('test_streamer', 'room_999');
    sessionService.recordViewers(500);
    sessionService.recordViewers(1500);
    sessionService.recordViewers(800);

    const analytics = sessionService.getCurrentAnalytics();
    assert.strictEqual(analytics.hasActiveSession, true);
    assert.strictEqual(analytics.summary.streamer, 'test_streamer');
    assert.strictEqual(analytics.summary.peakViewers, 1500);
  });

  it('should record gifts and rank top gifters by diamond count', () => {
    sessionService.startSession('test_streamer');

    sessionService.recordGift({
      uniqueId: 'donor_alice',
      nickname: 'Alice',
      diamonds: 100,
      repeatCount: 1,
      gift: { giftName: 'Rose' }
    });

    sessionService.recordGift({
      uniqueId: 'donor_bob',
      nickname: 'Bob',
      diamonds: 500,
      repeatCount: 1,
      gift: { giftName: 'Galaxy' }
    });

    sessionService.recordGift({
      uniqueId: 'donor_alice',
      nickname: 'Alice',
      diamonds: 600, // Total Alice: 700
      repeatCount: 6,
      gift: { giftName: 'Rose' }
    });

    const analytics = sessionService.getCurrentAnalytics();
    assert.strictEqual(analytics.summary.totalDiamonds, 1200);
    assert.strictEqual(analytics.topGifters.length, 2);
    // Rank 1: Alice with 700 diamonds
    assert.strictEqual(analytics.topGifters[0].uniqueId, 'donor_alice');
    assert.strictEqual(analytics.topGifters[0].diamonds, 700);
    // Rank 2: Bob with 500 diamonds
    assert.strictEqual(analytics.topGifters[1].uniqueId, 'donor_bob');
    assert.strictEqual(analytics.topGifters[1].diamonds, 500);
  });

  it('should generate valid CSV and JSON export data', () => {
    sessionService.startSession('export_tester');
    sessionService.recordChat({
      uniqueId: 'user1',
      nickname: 'User One',
      comment: 'Keren banget live-nya!'
    });
    sessionService.recordGift({
      uniqueId: 'top_donor',
      nickname: 'Big Spender',
      diamonds: 1000,
      repeatCount: 1,
      gift: { giftName: 'Dragon' }
    });

    // CSV test
    const csvExport = sessionService.generateExport('csv');
    assert.strictEqual(csvExport.format, 'csv');
    assert.strictEqual(csvExport.data.includes('STRECHAT - TIKTOK LIVE SESSION REPORT'), true);
    assert.strictEqual(csvExport.data.includes('export_tester'), true);
    assert.strictEqual(csvExport.data.includes('top_donor'), true);
    assert.strictEqual(csvExport.data.includes('Dragon'), true);

    // JSON test
    const jsonExport = sessionService.generateExport('json');
    assert.strictEqual(jsonExport.format, 'json');
    const parsed = JSON.parse(jsonExport.data);
    assert.strictEqual(parsed.app, 'strechat');
    assert.strictEqual(parsed.analytics.summary.streamer, 'export_tester');
    assert.strictEqual(parsed.analytics.summary.totalDiamonds, 1000);
  });

  it('should end session and persist summary cleanly', () => {
    sessionService.startSession('persistent_streamer');
    sessionService.recordViewers(250);
    const completed = sessionService.endSession();

    assert.strictEqual(completed.streamer, 'persistent_streamer');
    assert.strictEqual(typeof completed.endedAt, 'number');

    const history = sessionService.getHistory();
    assert.strictEqual(Array.isArray(history), true);
    assert.strictEqual(history.length > 0, true);
    assert.strictEqual(history[0].streamer, 'persistent_streamer');
  });
});
