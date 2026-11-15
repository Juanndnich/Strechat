/**
 * strechat - TikTok Live Connector Service
 * Manages live connection lifecycle, automatic reconnects, metrics calculation, and event normalization.
 */

const EventEmitter = require('events');
const { TikTokLiveConnection } = require('tiktok-live-connector');
const { cleanUsername, sanitizeComment, sanitizeGift } = require('./utils/sanitizer');

class TikTokLiveService extends EventEmitter {
  constructor() {
    super();
    this.connection = null;
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
      roomId: null,
      roomInfo: null
    };
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
      roomId: null,
      roomInfo: null
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
      const clientConfig = {
        processInitialData: true,
        enableExtendedGiftInfo: true,
        requestHeaders: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        }
      };

      if (customOptions.sessionId && typeof customOptions.sessionId === 'string' && customOptions.sessionId.trim().length > 0) {
        clientConfig.sessionId = customOptions.sessionId.trim();
      }

      this.connection = new TikTokLiveConnection(this.uniqueId, clientConfig);

      this._bindEvents();

      const state = await this.connection.connect();
      this.status = 'CONNECTED';
      this.reconnectAttempts = 0;
      this.stats.connectedAt = Date.now();
      this.stats.roomId = state?.roomId || null;
      this.stats.roomInfo = state?.roomInfo || null;

      this.emit('connected', {
        uniqueId: this.uniqueId,
        roomId: this.stats.roomId,
        status: this.status
      });
      this.emit('status', this.getStatus());

      return this.getStatus();
    } catch (err) {
      this.status = 'DISCONNECTED';
      this.emit('status', this.getStatus());
      this.emit('error', {
        message: err?.message || 'Gagal terhubung ke live stream TikTok.',
        detail: String(err)
      });
      throw err;
    }
  }

  _bindEvents() {
    if (!this.connection) return;

    // Chat Message
    this.connection.on('chat', (data) => {
      this.stats.totalComments++;
      const chatEvent = {
        id: `chat-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        uniqueId: cleanUsername(data?.uniqueId),
        nickname: cleanUsername(data?.nickname || data?.uniqueId),
        comment: sanitizeComment(data?.comment),
        profilePictureUrl: data?.profilePictureUrl || '',
        badges: Array.isArray(data?.userBadges)
          ? data.userBadges.map((b) => ({
              type: b?.badgeSceneType || 'badge',
              name: b?.name || ''
            }))
          : [],
        isModerator: Boolean(data?.isModerator),
        isSubscriber: Boolean(data?.isSubscriber),
        timestamp: Date.now()
      };

      this.emit('chat', chatEvent);
      this.emit('stats_update', this.getStatus());
    });

    // Gifts / GIFs
    this.connection.on('gift', (data) => {
      const sanitizedGift = sanitizeGift(data);
      if (!sanitizedGift) return;

      const diamonds = sanitizedGift.diamondCount * (data.repeatEnd ? sanitizedGift.repeatCount : 1);
      if (data.repeatEnd || sanitizedGift.repeatCount === 1) {
        this.stats.totalDiamonds += diamonds;
        this.stats.totalGifts += sanitizedGift.repeatCount;
      }

      const giftEvent = {
        id: `gift-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        uniqueId: cleanUsername(data?.uniqueId),
        nickname: cleanUsername(data?.nickname || data?.uniqueId),
        profilePictureUrl: data?.profilePictureUrl || '',
        gift: sanitizedGift,
        repeatCount: sanitizedGift.repeatCount,
        repeatEnd: Boolean(data?.repeatEnd),
        diamonds: sanitizedGift.diamondCount,
        timestamp: Date.now()
      };

      this.emit('gift', giftEvent);
      this.emit('stats_update', this.getStatus());
    });

    // Likes
    this.connection.on('like', (data) => {
      const addedLikes = Number(data?.likeCount) || 1;
      this.stats.sessionLikes += addedLikes;
      if (data?.totalLikeCount) {
        this.stats.totalLikes = Math.max(this.stats.totalLikes, Number(data.totalLikeCount));
      } else {
        this.stats.totalLikes += addedLikes;
      }

      const likeEvent = {
        uniqueId: cleanUsername(data?.uniqueId),
        nickname: cleanUsername(data?.nickname || data?.uniqueId),
        likeCount: addedLikes,
        totalLikes: this.stats.totalLikes,
        timestamp: Date.now()
      };

      this.emit('like', likeEvent);
      this.emit('stats_update', this.getStatus());
    });

    // Room User / Viewers
    this.connection.on('roomUser', (data) => {
      const count = Number(data?.viewerCount) || 0;
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

    // User Joined
    this.connection.on('member', (data) => {
      const memberEvent = {
        uniqueId: cleanUsername(data?.uniqueId),
        nickname: cleanUsername(data?.nickname || data?.uniqueId),
        profilePictureUrl: data?.profilePictureUrl || '',
        timestamp: Date.now()
      };
      this.emit('member', memberEvent);
    });

    // User Shared or Followed
    this.connection.on('social', (data) => {
      const socialEvent = {
        uniqueId: cleanUsername(data?.uniqueId),
        nickname: cleanUsername(data?.nickname || data?.uniqueId),
        action: data?.displayType || 'social',
        timestamp: Date.now()
      };
      this.emit('social', socialEvent);
    });

    // Stream Ended
    this.connection.on('streamEnd', () => {
      this.status = 'DISCONNECTED';
      this.emit('streamEnd', {
        message: 'Live stream telah berakhir oleh host.',
        stats: this.stats
      });
      this.emit('status', this.getStatus());
    });

    // Disconnected
    this.connection.on('disconnected', () => {
      if (!this.isManualDisconnect && this.status === 'CONNECTED') {
        this._handleAutoReconnect();
      } else {
        this.status = 'DISCONNECTED';
        this.emit('status', this.getStatus());
      }
    });

    // Error
    this.connection.on('error', (err) => {
      this.emit('error', {
        message: err?.message || 'Kesalahan koneksi live TikTok',
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
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 15000);

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
      } catch (err) {
        // Auto-reconnect failure will trigger another cycle if not at max
      }
    }, delay);
  }

  async disconnect() {
    this.isManualDisconnect = true;
    clearTimeout(this.reconnectTimer);

    if (this.connection) {
      try {
        await this.connection.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      this.connection = null;
    }

    this.status = 'DISCONNECTED';
    this.emit('disconnected', { message: 'Koneksi diputus oleh pengguna.' });
    this.emit('status', this.getStatus());
  }
}

module.exports = new TikTokLiveService();
