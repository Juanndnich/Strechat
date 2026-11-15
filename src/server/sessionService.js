/**
 * strechat - Live Session & Analytics Service
 * Tracks real-time session metrics, donor leaderboards, session history, and CSV/JSON export.
 */

const fs = require('fs');
const path = require('path');

class SessionService {
  constructor() {
    this.dataDir = path.join(__dirname, '..', '..', 'data');
    this.historyFile = path.join(this.dataDir, 'sessions.json');
    this.currentSession = null;
    this.viewerSampleInterval = null;

    this._ensureDataDir();
  }

  _ensureDataDir() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
    } catch (e) {
      console.warn('[strechat] Gagal membuat direktori data session:', e.message);
    }
  }

  startSession(streamerUsername, roomId = null) {
    // End active session if already running
    if (this.currentSession && !this.currentSession.endedAt) {
      this.endSession();
    }

    const now = Date.now();
    this.currentSession = {
      id: `session_${now}`,
      streamer: streamerUsername || 'streamer',
      roomId: roomId || null,
      startedAt: now,
      endedAt: null,
      durationSeconds: 0,
      peakViewers: 0,
      viewerSamples: [],
      totalLikes: 0,
      totalDiamonds: 0,
      totalGifts: 0,
      totalComments: 0,
      topGifters: {}, // { [uniqueId]: { uniqueId, nickname, avatar, diamonds, count } }
      topChatters: {}, // { [uniqueId]: { uniqueId, nickname, count } }
      events: [] // Circular buffer of up to 300 events for export
    };

    return this.currentSession;
  }

  recordViewers(count) {
    if (!this.currentSession) return;
    const num = Math.max(0, Number(count) || 0);
    if (num > this.currentSession.peakViewers) {
      this.currentSession.peakViewers = num;
    }

    const now = Date.now();
    // Sample viewers every 20 seconds to prevent memory bloat
    const lastSample = this.currentSession.viewerSamples[this.currentSession.viewerSamples.length - 1];
    if (!lastSample || (now - lastSample.time) >= 20000) {
      this.currentSession.viewerSamples.push({ time: now, count: num });
      if (this.currentSession.viewerSamples.length > 500) {
        this.currentSession.viewerSamples.shift();
      }
    }
  }

  recordLike(likeEvent) {
    if (!this.currentSession) return;
    const count = Number(likeEvent?.likeCount || 1);
    this.currentSession.totalLikes += count;
  }

  recordChat(chatEvent) {
    if (!this.currentSession) return;
    this.currentSession.totalComments++;

    const uid = chatEvent.uniqueId || 'user';
    if (!this.currentSession.topChatters[uid]) {
      this.currentSession.topChatters[uid] = {
        uniqueId: uid,
        nickname: chatEvent.nickname || uid,
        count: 0
      };
    }
    this.currentSession.topChatters[uid].count++;

    // Add to export events (keep up to 300)
    this.currentSession.events.push({
      type: 'chat',
      time: chatEvent.timestamp || Date.now(),
      uniqueId: uid,
      nickname: chatEvent.nickname || uid,
      detail: chatEvent.comment || ''
    });

    if (this.currentSession.events.length > 300) {
      this.currentSession.events.shift();
    }
  }

  recordGift(giftEvent) {
    if (!this.currentSession) return;
    const diamonds = Math.max(0, Number(giftEvent.diamonds) || 0);
    const count = Math.max(1, Number(giftEvent.repeatCount) || 1);
    const giftName = giftEvent.gift?.giftName || 'Gift';

    this.currentSession.totalDiamonds += diamonds;
    this.currentSession.totalGifts += count;

    const uid = giftEvent.uniqueId || 'gifter';
    if (!this.currentSession.topGifters[uid]) {
      this.currentSession.topGifters[uid] = {
        uniqueId: uid,
        nickname: giftEvent.nickname || uid,
        avatar: giftEvent.profilePictureUrl || '',
        diamonds: 0,
        giftCount: 0
      };
    }
    this.currentSession.topGifters[uid].diamonds += diamonds;
    this.currentSession.topGifters[uid].giftCount += count;

    // Add to export events
    this.currentSession.events.push({
      type: 'gift',
      time: giftEvent.timestamp || Date.now(),
      uniqueId: uid,
      nickname: giftEvent.nickname || uid,
      detail: `${giftName} (x${count}) - ${diamonds} Diamonds`
    });

    if (this.currentSession.events.length > 300) {
      this.currentSession.events.shift();
    }
  }

  getCurrentAnalytics() {
    if (!this.currentSession) {
      return {
        hasActiveSession: false,
        summary: null,
        topGifters: [],
        topChatters: []
      };
    }

    const now = Date.now();
    const duration = Math.floor((now - this.currentSession.startedAt) / 1000);
    this.currentSession.durationSeconds = duration;

    // Calculate average viewers
    let avgViewers = 0;
    if (this.currentSession.viewerSamples.length > 0) {
      const sum = this.currentSession.viewerSamples.reduce((acc, s) => acc + s.count, 0);
      avgViewers = Math.round(sum / this.currentSession.viewerSamples.length);
    }

    // Top 5 gifters sorted by total diamonds
    const sortedGifters = Object.values(this.currentSession.topGifters)
      .sort((a, b) => b.diamonds - a.diamonds)
      .slice(0, 5);

    // Top 5 chatters sorted by comment count
    const sortedChatters = Object.values(this.currentSession.topChatters)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      hasActiveSession: true,
      summary: {
        id: this.currentSession.id,
        streamer: this.currentSession.streamer,
        startedAt: this.currentSession.startedAt,
        durationSeconds: duration,
        peakViewers: this.currentSession.peakViewers,
        averageViewers: avgViewers,
        totalLikes: this.currentSession.totalLikes,
        totalDiamonds: this.currentSession.totalDiamonds,
        totalGifts: this.currentSession.totalGifts,
        totalComments: this.currentSession.totalComments
      },
      topGifters: sortedGifters,
      topChatters: sortedChatters
    };
  }

  endSession() {
    if (!this.currentSession || this.currentSession.endedAt) return null;

    this.currentSession.endedAt = Date.now();
    this.currentSession.durationSeconds = Math.floor((this.currentSession.endedAt - this.currentSession.startedAt) / 1000);

    const completed = { ...this.currentSession };
    this._persistSession(completed);
    this.currentSession = null;
    return completed;
  }

  _persistSession(session) {
    try {
      this._ensureDataDir();
      let history = [];
      if (fs.existsSync(this.historyFile)) {
        const raw = fs.readFileSync(this.historyFile, 'utf8');
        history = JSON.parse(raw);
        if (!Array.isArray(history)) history = [];
      }

      // Compact representation for storage
      const summaryToSave = {
        id: session.id,
        streamer: session.streamer,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        durationSeconds: session.durationSeconds,
        peakViewers: session.peakViewers,
        totalLikes: session.totalLikes,
        totalDiamonds: session.totalDiamonds,
        totalGifts: session.totalGifts,
        totalComments: session.totalComments,
        topGifters: Object.values(session.topGifters).sort((a, b) => b.diamonds - a.diamonds).slice(0, 5)
      };

      history.unshift(summaryToSave);
      // Retain max 50 sessions
      if (history.length > 50) history = history.slice(0, 50);

      fs.writeFileSync(this.historyFile, JSON.stringify(history, null, 2), 'utf8');
    } catch (e) {
      console.warn('[strechat] Gagal menyimpan history sesi:', e.message);
    }
  }

  getHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        const raw = fs.readFileSync(this.historyFile, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.warn('[strechat] Gagal membaca history sesi:', e.message);
    }
    return [];
  }

  generateExport(format = 'json') {
    const analytics = this.getCurrentAnalytics();
    const session = this.currentSession || (this.getHistory()[0] || null);

    if (!session) {
      return { format, data: format === 'json' ? '{}' : 'No session data' };
    }

    if (format === 'csv') {
      const rows = [];
      rows.push(['STRECHAT - TIKTOK LIVE SESSION REPORT']);
      rows.push(['Streamer', session.streamer || 'N/A']);
      rows.push(['Tanggal', new Date(session.startedAt).toLocaleString('id-ID')]);
      rows.push(['Durasi (Detik)', session.durationSeconds || 0]);
      rows.push(['Peak Viewers', session.peakViewers || 0]);
      rows.push(['Total Likes', session.totalLikes || 0]);
      rows.push(['Total Diamonds', session.totalDiamonds || 0]);
      rows.push(['Total Gifts', session.totalGifts || 0]);
      rows.push(['Total Komentar', session.totalComments || 0]);
      rows.push([]);

      rows.push(['--- TOP DONATUR (GIFTERS) ---']);
      rows.push(['Rank', 'Username', 'Nickname', 'Diamonds', 'Jumlah Gift']);
      analytics.topGifters.forEach((g, idx) => {
        rows.push([idx + 1, g.uniqueId, `"${g.nickname}"`, g.diamonds, g.giftCount]);
      });
      rows.push([]);

      rows.push(['--- RIWAYAT OBROLAN & EVENT ---']);
      rows.push(['Waktu', 'Tipe', 'Pengirim', 'Pesan / Detail']);
      if (this.currentSession && Array.isArray(this.currentSession.events)) {
        this.currentSession.events.forEach((ev) => {
          const t = new Date(ev.time).toLocaleTimeString('id-ID');
          rows.push([t, ev.type, `"${ev.nickname}"`, `"${String(ev.detail).replace(/"/g, '""')}"`]);
        });
      }

      const csvContent = rows.map(r => r.join(',')).join('\r\n');
      return { format: 'csv', data: csvContent };
    }

    // Default JSON format
    return {
      format: 'json',
      data: JSON.stringify({
        app: 'strechat',
        exportedAt: new Date().toISOString(),
        analytics,
        events: this.currentSession ? this.currentSession.events : []
      }, null, 2)
    };
  }
}

module.exports = new SessionService();
