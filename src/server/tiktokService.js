/**
 * strechat - TikTok Live Connector Service
 * Direct Webcast WebSocket connection with resilient connection lifecycle and continuous live sync.
 */

const EventEmitter = require('events');
const { cleanUsername, sanitizeComment, sanitizeGift } = require('./utils/sanitizer');
const sessionService = require('./sessionService');

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
    this.syncTimer = null;
    this.graceTimer = null;
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
      const { TikTokLiveClient, EventType, fetchRoomInfo } = await import('piratetok-live-js');

      this.client = new TikTokLiveClient(this.uniqueId);

      // Secure optional TikTok session cookies (e.g. for 18+ or private rooms)
      const rawSession = this.options?.sessionId ? String(this.options.sessionId).trim() : '';
      const sessionCookie = rawSession ? (rawSession.includes('=') ? rawSession : `sessionid=${rawSession}`) : undefined;
      if (sessionCookie) {
        this.client.cookies(sessionCookie);
      }

      // Bind events
      this._bindClientEvents(EventType, fetchRoomInfo, sessionCookie);

      // Start connection
      this.client.connect().catch((err) => {
        if (!this.isManualDisconnect) {
          const errMsg = this._formatErrorMessage(err);
          this.status = 'DISCONNECTED';
          clearInterval(this.syncTimer);
          clearTimeout(this.graceTimer);
          this.emit('status', this.getStatus());
          this.emit('error', {
            message: errMsg,
            detail: String(err?.message || err)
          });
        }
      });

      return this.getStatus();
    } catch (err) {
      this.status = 'DISCONNECTED';
      clearInterval(this.syncTimer);
      clearTimeout(this.graceTimer);
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
    const lower = raw.toLowerCase();
    if (lower.includes('not currently live') || lower.includes('offline') || lower.includes('hostnotonline')) {
      return `Streamer @${this.uniqueId} sedang offline / tidak sedang live.`;
    }
    if (lower.includes('user not found') || lower.includes('usernotfound') || lower.includes('404')) {
      return `Pengguna @${this.uniqueId} tidak ditemukan di TikTok. Periksa kembali ejaan username.`;
    }
    if (lower.includes('age restricted') || lower.includes('agerestricted')) {
      return `Live stream @${this.uniqueId} dibatasi usia (18+). Masukkan sessionid di Pengaturan untuk mengakses.`;
    }
    if (lower.includes('sessionrequired') || lower.includes('session required')) {
      return `Live stream @${this.uniqueId} memerlukan sessionid TikTok di Pengaturan.`;
    }
    if (lower.includes('403') || lower.includes('blocked') || lower.includes('tiktokblocked')) {
      return `Koneksi ke @${this.uniqueId} ditolak TikTok (HTTP 403). Akun mungkin sedang offline atau permintaan dibatasi sementara oleh TikTok. Pastikan akun sedang aktif LIVE.`;
    }
    return `Koneksi ke @${this.uniqueId} gagal: ${raw}`;
  }

  _bindClientEvents(EventType, fetchRoomInfo, sessionCookie) {
    if (!this.client) return;

    // Helper: Mark stream active whenever any packet or event arrives
    const markAlive = () => {
      clearTimeout(this.graceTimer);
      if (this.status !== 'CONNECTED' && !this.isManualDisconnect) {
        this.status = 'CONNECTED';
        if (!this.stats.connectedAt) {
          this.stats.connectedAt = Date.now();
        }
        this.emit('connected', {
          uniqueId: this.uniqueId,
          roomId: this.stats.roomId,
          status: this.status
        });
        this.emit('status', this.getStatus());
      }
    };

    // Connection opened
    this.client.on(EventType.connected, async (data) => {
      this.status = 'CONNECTED';
      this.reconnectAttempts = 0;
      this.stats.connectedAt = this.stats.connectedAt || Date.now();
      this.stats.roomId = data?.roomId || null;

      // Start live session tracking (P4)
      sessionService.startSession(this.uniqueId, this.stats.roomId);

      // Seed initial room statistics (viewers & likes) immediately
      if (this.stats.roomId) {
        try {
          const roomInfo = await fetchRoomInfo(this.stats.roomId, 6000, sessionCookie);
          if (roomInfo) {
            const initialViewers = Number(roomInfo.viewers || roomInfo.totalUser || 0);
            const initialLikes = Number(roomInfo.likes || 0);

            if (initialViewers > 0) {
              this.stats.viewerCount = initialViewers;
              if (initialViewers > this.stats.peakViewers) {
                this.stats.peakViewers = initialViewers;
              }
            }
            if (initialLikes > 0) {
              this.stats.totalLikes = initialLikes;
            }
          }
        } catch (e) {
          console.warn('[strechat] Initial room info fetch warning:', e.message);
        }
      }

      this.emit('connected', {
        uniqueId: this.uniqueId,
        roomId: this.stats.roomId,
        status: this.status
      });
      this.emit('status', this.getStatus());

      // Start periodic room info polling to keep stats continuous and robust
      clearInterval(this.syncTimer);
      this.syncTimer = setInterval(async () => {
        if (this.status !== 'CONNECTED' || !this.stats.roomId) return;
        try {
          const info = await fetchRoomInfo(this.stats.roomId, 5000, sessionCookie);
          if (info) {
            let updated = false;
            const liveViewers = Number(info.viewers || info.totalUser || 0);
            const liveLikes = Number(info.likes || 0);

            if (liveViewers > 0 && liveViewers !== this.stats.viewerCount) {
              this.stats.viewerCount = liveViewers;
              if (liveViewers > this.stats.peakViewers) {
                this.stats.peakViewers = liveViewers;
              }
              updated = true;
            }

            if (liveLikes > 0 && liveLikes > this.stats.totalLikes) {
              this.stats.totalLikes = liveLikes;
              updated = true;
            }

            if (updated) {
              this.emit('stats_update', this.getStatus());
            }
          }
        } catch (e) {}
      }, 6000);
    });

    // Chat Message
    this.client.on(EventType.chat, (data) => {
      markAlive();
      this.stats.totalComments++;
      const user = data?.user || {};
      const uniqueId = cleanUsername(user?.displayId || user?.nickname || 'user');
      const nickname = cleanUsername(user?.nickname || user?.displayId || uniqueId);
      const comment = sanitizeComment(data?.content || '');

      let avatarUrl = '';
      if (user?.profileThumb?.urlList && Array.isArray(user.profileThumb.urlList) && user.profileThumb.urlList.length > 0) {
        avatarUrl = user.profileThumb.urlList[0] || '';
      }

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
      sessionService.recordChat(chatEvent);
      this.emit('stats_update', this.getStatus());
    });

    // Gift Message
    this.client.on(EventType.gift, (data) => {
      markAlive();
      const giftData = data?.gift || {};
      const user = data?.user || {};
      const repeatCount = Math.max(1, Number(data?.repeatCount || data?.comboCount || 1));
      const diamondCount = Math.max(0, Number(giftData?.diamondCount || 0));
      const isOver = Boolean(data?.isStreakOver ?? (Number(data?.repeatEnd ?? 0) === 1));

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
      sessionService.recordGift(giftEvent);
      this.emit('stats_update', this.getStatus());
    });

    // Likes
    this.client.on(EventType.like, (data) => {
      markAlive();
      const addedLikes = Number(data?.count || 1);
      this.stats.sessionLikes += addedLikes;
      const currentTotal = Number(data?.total || 0);
      if (currentTotal > this.stats.totalLikes) {
        this.stats.totalLikes = currentTotal;
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
      sessionService.recordLike(likeEvent);
      this.emit('stats_update', this.getStatus());
    });

    // Room User Seq (Viewers)
    this.client.on(EventType.roomUserSeq, (data) => {
      markAlive();
      const count = Number(data?.viewerCount ?? data?.totalUser ?? data?.total ?? data?.popularity ?? 0);
      if (count > 0) {
        this.stats.viewerCount = count;
        if (count > this.stats.peakViewers) {
          this.stats.peakViewers = count;
        }

        this.emit('viewers', {
          viewerCount: this.stats.viewerCount,
          peakViewers: this.stats.peakViewers,
          timestamp: Date.now()
        });
        sessionService.recordViewers(count);
        this.emit('stats_update', this.getStatus());
      }
    });

    // Reconnecting event from client's internal supervisor
    this.client.on(EventType.reconnecting, (info) => {
      if (!this.isManualDisconnect) {
        this.status = 'RECONNECTING';
        this.emit('reconnecting', {
          attempt: info?.attempt || 1,
          maxAttempts: info?.maxRetries || 5
        });
        this.emit('status', this.getStatus());
      }
    });

    // Stream Ended by Host
    this.client.on(EventType.liveEnded, () => {
      this.status = 'DISCONNECTED';
      sessionService.endSession();
      clearInterval(this.syncTimer);
      clearTimeout(this.graceTimer);
      this.emit('streamEnd', {
        message: 'Live stream telah berakhir oleh host.',
        stats: this.stats
      });
      this.emit('status', this.getStatus());
    });

    // Disconnected (Graceful handling: do not drop UI if client is reconnecting in background)
    this.client.on(EventType.disconnected, () => {
      if (this.isManualDisconnect) {
        clearInterval(this.syncTimer);
        clearTimeout(this.graceTimer);
        this.status = 'DISCONNECTED';
        this.emit('status', this.getStatus());
      } else {
        // Give a 6-second grace period: supervisor loop is likely rotating the socket
        clearTimeout(this.graceTimer);
        this.graceTimer = setTimeout(() => {
          if (!this.isManualDisconnect && this.status !== 'CONNECTED') {
            clearInterval(this.syncTimer);
            this.status = 'DISCONNECTED';
            this.emit('status', this.getStatus());
          }
        }, 6000);
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

  async disconnect() {
    this.isManualDisconnect = true;
    sessionService.endSession();
    clearTimeout(this.reconnectTimer);
    clearTimeout(this.graceTimer);
    clearInterval(this.syncTimer);

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

  /**
   * Check if a streamer is currently live on TikTok (used by Auto-Detect OBS feature)
   */
  async checkLiveStatus(targetUsername) {
    if (!targetUsername || typeof targetUsername !== 'string' || !targetUsername.trim()) {
      return { isLive: false, error: 'Username tidak valid' };
    }

    const username = cleanUsername(targetUsername);
    if (!username || username === 'anonymous') {
      return { isLive: false, error: 'Username tidak valid' };
    }

    try {
      const { checkOnline } = await import('piratetok-live-js');
      const result = await checkOnline(username, 6000);
      if (result && result.roomId && result.roomId !== '0') {
        return {
          isLive: true,
          roomId: String(result.roomId),
          anchorId: String(result.anchorId || '')
        };
      }
      return { isLive: false };
    } catch (err) {
      const msg = String(err?.message || '');
      if (msg.includes('not online') || err?.name === 'HostNotOnlineError' || msg.includes('403') || msg.includes('blocked')) {
        return { isLive: false };
      }
      return { isLive: false, error: msg };
    }
  }
}

module.exports = new TikTokLiveService();
