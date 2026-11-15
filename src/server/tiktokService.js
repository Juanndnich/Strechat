/**
 * strechat - TikTok Live Connector Service
 * Direct Webcast WebSocket connection without third-party paid signing dependencies.
 */

const EventEmitter = require('events');
const { cleanUsername, sanitizeComment, sanitizeGift } = require('./utils/sanitizer');

class TikTokLiveService extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.uniqueId = null;
    this.options = {};
    this.status = 'DISCONNECTED'; // DISCONNECTED | CONNECTING | CONNECTED | RECONNECTING
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimer = null;
    this.isManualDisconnect = false;

    // Session Statistics
    this.stats = {
      viewerCount: 0,
      peakViewers: 0,
      totalLikes: 0,
      sessionLikes: 0,
      totalDiamonds: 0,
      totalGifts: 0,
      totalComments: 0,
      connectedAt: null,
      roomId: null
    };

    // Prevent unhandled error crashes if no external listener is attached
    this.on('error', () => {});
  }

  resetStats() {
    this.stats = {
      viewerCount: 0,
      peakViewers: 0,
      totalLikes: 0,
      sessionLikes: 0,
      totalDiamonds: 0,
      totalGifts: 0,
      totalComments: 0,
      connectedAt: null,
      roomId: null
    };
  }

  getStatus() {
    return {
      status: this.status,
      uniqueId: this.uniqueId,
      stats: {
        ...this.stats,
        uptimeSeconds: this.stats.connectedAt ? Math.floor((Date.now() - this.stats.connectedAt) / 1000) : 0
      }
    };
  }

  async connect(targetUsername, customOptions = {}) {
    const username = cleanUsername(targetUsername);
    if (!username) {
      throw new Error('Username TikTok tidak valid');
    }

    if (this.status === 'CONNECTED' || this.status === 'CONNECTING') {
      await this.disconnect();
    }

    this.isManualDisconnect = false;
    this.uniqueId = username;
    this.options = customOptions;
    this.status = 'CONNECTING';
    this.emit('status', this.getStatus());

    try {
      // Dynamic import of piratetok-live-js (ESM)
      const { TikTokLiveClient, EventType } = await import('piratetok-live-js');

      this.client = new TikTokLiveClient(this.uniqueId);

      // Bind events
      this._bindClientEvents(EventType);

      // Start connection
      // client.connect() resolves when connected or supervisor loop terminates
      this.client.connect().catch((err) => {
        if (!this.isManualDisconnect) {
          const errMsg = this._formatErrorMessage(err);
          this.status = 'DISCONNECTED';
          this.emit('status', this.getStatus());
          this.emit('error', {
            message: errMsg,
            detail: String(err?.message || err)
          });
        }
      });

      // Mark connected when connection opens
      return this.getStatus();
    } catch (err) {
      this.status = 'DISCONNECTED';
      const errMsg = this._formatErrorMessage(err);
      this.emit('status', this.getStatus());
      this.emit('error', {
        message: errMsg,
        detail: String(err?.message || err)
      });
      throw new Error(errMsg);
    }
  }

  _formatErrorMessage(err) {
    const raw = String(err?.message || err || '');
    if (raw.toLowerCase().includes('not currently live') || raw.toLowerCase().includes('offline')) {
      return `Streamer @${this.uniqueId} sedang offline / tidak sedang live.`;
    }
    if (raw.toLowerCase().includes('user not found') || raw.toLowerCase().includes('404')) {
      return `Pengguna @${this.uniqueId} tidak ditemukan di TikTok.`;
    }
    if (raw.toLowerCase().includes('age restricted')) {
      return `Live stream @${this.uniqueId} dibatasi usia.`;
    }
    return `Koneksi ke @${this.uniqueId} gagal: ${raw}`;
  }

  _bindClientEvents(EventType) {
    if (!this.client) return;

    // Connection opened
    this.client.on(EventType.connected, (data) => {
      this.status = 'CONNECTED';
      this.reconnectAttempts = 0;
      this.stats.connectedAt = Date.now();
      this.stats.roomId = data?.roomId || null;

      this.emit('connected', {
        uniqueId: this.uniqueId,
        roomId: this.stats.roomId,
        status: this.status
      });
      this.emit('status', this.getStatus());
    });

    // Chat Message
    this.client.on(EventType.chat, (data) => {
      this.stats.totalComments++;
      const user = data?.user || {};
      const uniqueId = cleanUsername(user?.displayId || user?.nickname || 'user');
      const nickname = cleanUsername(user?.nickname || user?.displayId || uniqueId);
      const comment = sanitizeComment(data?.content || '');

      // Avatar extraction from Webcast profileThumb
      let avatarUrl = '';
      if (user?.profileThumb?.urlList && Array.isArray(user.profileThumb.urlList) && user.profileThumb.urlList.length > 0) {
        avatarUrl = user.profileThumb.urlList[0] || '';
      }

      // Moderator check
      let isMod = false;
      if (Array.isArray(user?.badgeList)) {
        isMod = user.badgeList.some(b => String(b?.name || '').toLowerCase().includes('mod'));
      }

      const chatEvent = {
        id: `chat-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        uniqueId,
        nickname,
        comment,
        profilePictureUrl: avatarUrl,
        badges: isMod ? [{ type: 'mod', name: 'MOD' }] : [],
        isModerator: isMod,
        isSubscriber: false,
        timestamp: Date.now()
      };

      this.emit('chat', chatEvent);
      this.emit('stats_update', this.getStatus());
    });

    // Gift Message
    this.client.on(EventType.gift, (data) => {
      const giftData = data?.gift || {};
      const user = data?.user || {};
      const repeatCount = Math.max(1, Number(data?.repeatCount || data?.comboCount || 1));
      const diamondCount = Math.max(0, Number(giftData?.diamondCount || 0));
      const isOver = Boolean(data?.isStreakOver ?? (Number(data?.repeatEnd ?? 0) === 1));

      // Gift icon
      let giftIcon = '';
      if (giftData?.image?.urlList && Array.isArray(giftData.image.urlList) && giftData.image.urlList.length > 0) {
        giftIcon = giftData.image.urlList[0] || '';
      }

      const diamonds = diamondCount * (isOver ? repeatCount : 1);
      if (isOver || repeatCount === 1) {
        this.stats.totalDiamonds += diamonds;
        this.stats.totalGifts += repeatCount;
      }

      let avatarUrl = '';
      if (user?.profileThumb?.urlList && Array.isArray(user.profileThumb.urlList) && user.profileThumb.urlList.length > 0) {
        avatarUrl = user.profileThumb.urlList[0] || '';
      }

      const giftEvent = {
        id: `gift-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        uniqueId: cleanUsername(user?.displayId || user?.nickname || 'gifter'),
        nickname: cleanUsername(user?.nickname || user?.displayId || 'Gifter'),
        profilePictureUrl: avatarUrl,
        gift: {
          giftId: Number(giftData?.id) || 0,
          giftName: sanitizeComment(giftData?.name || 'Gift'),
          diamondCount,
          repeatCount,
          repeatEnd: isOver,
          giftPictureUrl: giftIcon
        },
        repeatCount,
        repeatEnd: isOver,
        diamonds,
        timestamp: Date.now()
      };

      this.emit('gift', giftEvent);
      this.emit('stats_update', this.getStatus());
    });

    // Likes
    this.client.on(EventType.like, (data) => {
      const addedLikes = Number(data?.count) || 1;
      this.stats.sessionLikes += addedLikes;
      if (data?.total) {
        this.stats.totalLikes = Math.max(this.stats.totalLikes, Number(data.total));
      } else {
        this.stats.totalLikes += addedLikes;
      }

      const user = data?.user || {};
      const likeEvent = {
        uniqueId: cleanUsername(user?.displayId || user?.nickname || 'user'),
        nickname: cleanUsername(user?.nickname || user?.displayId || 'User'),
        likeCount: addedLikes,
        totalLikes: this.stats.totalLikes,
        timestamp: Date.now()
      };

      this.emit('like', likeEvent);
      this.emit('stats_update', this.getStatus());
    });

    // Room User Seq (Viewers)
    this.client.on(EventType.roomUserSeq, (data) => {
      const count = Number(data?.total) || 0;
      this.stats.viewerCount = count;
      if (count > this.stats.peakViewers) {
        this.stats.peakViewers = count;
      }

      this.emit('viewers', {
        viewerCount: this.stats.viewerCount,
        peakViewers: this.stats.peakViewers,
        timestamp: Date.now()
      });
      this.emit('stats_update', this.getStatus());
    });

    // Stream Ended
    this.client.on(EventType.liveEnded, () => {
      this.status = 'DISCONNECTED';
      this.emit('streamEnd', {
        message: 'Live stream telah berakhir oleh host.',
        stats: this.stats
      });
      this.emit('status', this.getStatus());
    });

    // Disconnected
    this.client.on(EventType.disconnected, () => {
      if (!this.isManualDisconnect && this.status === 'CONNECTED') {
        this._handleAutoReconnect();
      } else {
        this.status = 'DISCONNECTED';
        this.emit('status', this.getStatus());
      }
    });

    // Error
    this.client.on('error', (err) => {
      const errMsg = this._formatErrorMessage(err);
      this.emit('error', {
        message: errMsg,
        detail: String(err)
      });
    });
  }

  _handleAutoReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.status = 'DISCONNECTED';
      this.emit('status', this.getStatus());
      this.emit('error', {
        message: 'Koneksi terputus dan percobaan sambung ulang maksimal tercapai.',
        detail: 'Max reconnect attempts exceeded'
      });
      return;
    }

    this.reconnectAttempts++;
    this.status = 'RECONNECTING';
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);

    this.emit('reconnecting', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      delayMs: delay
    });
    this.emit('status', this.getStatus());

    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(async () => {
      try {
        if (this.uniqueId && !this.isManualDisconnect) {
          await this.connect(this.uniqueId, this.options);
        }
      } catch (err) {}
    }, delay);
  }

  async disconnect() {
    this.isManualDisconnect = true;
    clearTimeout(this.reconnectTimer);

    if (this.client) {
      try {
        this.client.disconnect();
      } catch (e) {}
      this.client = null;
    }

    this.status = 'DISCONNECTED';
    this.emit('disconnected', { message: 'Koneksi diputus oleh pengguna.' });
    this.emit('status', this.getStatus());
  }
}

module.exports = new TikTokLiveService();
