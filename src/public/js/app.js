/**
 * strechat - Frontend Client Application
 * WebSocket manager, UI renderer, animations, filters, and state coordinator.
 */

(function () {
  'use strict';

  // State
  const state = {
    ws: null,
    connected: false,
    status: 'DISCONNECTED', // DISCONNECTED, CONNECTING, CONNECTED, RECONNECTING
    uniqueId: '',
    stats: {
      viewerCount: 0,
      peakViewers: 0,
      totalLikes: 0,
      totalDiamonds: 0,
      totalGifts: 0,
      totalComments: 0,
      uptimeSeconds: 0
    },
    filter: 'all', // all | questions | mods
    searchQuery: '',
    isAutoScroll: true,
    pinnedMessage: null,
    isDemo: false,
    pingMs: 0,
    uptimeTimer: null,
    isAlwaysOnTop: false,
    obsAutoDetect: false,
    obsAutoDetectTimer: null,
    isCheckingLive: false
  };

  // DOM Elements
  const el = {
    titlebar: document.getElementById('titlebar'),
    btnMin: document.getElementById('btn-min'),
    btnMax: document.getElementById('btn-max'),
    btnClose: document.getElementById('btn-close'),
    btnPin: document.getElementById('btn-pin'),
    channelInput: document.getElementById('channel-input'),
    btnConnect: document.getElementById('btn-connect'),
    btnDemo: document.getElementById('btn-demo'),
    btnAnalytics: document.getElementById('btn-analytics'),
    btnSettings: document.getElementById('btn-settings'),
    btnTheme: document.getElementById('btn-theme'),
    statusDot: document.getElementById('status-dot'),
    statusText: document.getElementById('status-text'),
    statusUptime: document.getElementById('status-uptime'),
    statusPing: document.getElementById('status-ping'),
    // Stats
    metricViewers: document.getElementById('metric-viewers'),
    metricPeak: document.getElementById('metric-peak'),
    metricLikes: document.getElementById('metric-likes'),
    metricDiamonds: document.getElementById('metric-diamonds'),
    metricComments: document.getElementById('metric-comments'),
    // Feed & Containers
    giftBannerArea: document.getElementById('gift-banner-area'),
    pinnedContainer: document.getElementById('pinned-container'),
    pinnedAuthor: document.getElementById('pinned-author'),
    pinnedText: document.getElementById('pinned-text'),
    btnDismissPin: document.getElementById('btn-dismiss-pin'),
    chatContainer: document.getElementById('chat-container'),
    chatEmpty: document.getElementById('chat-empty'),
    btnScrollBottom: document.getElementById('btn-scroll-bottom'),
    // Search & Filters
    filterPills: document.querySelectorAll('.pill-btn'),
    chatSearchInput: document.getElementById('chat-search-input'),
    // Settings Modal
    modalSettings: document.getElementById('modal-settings'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    remoteUrlText: document.getElementById('remote-url-text'),
    btnCopyRemote: document.getElementById('btn-copy-remote'),
    settingSound: document.getElementById('setting-sound'),
    settingTts: document.getElementById('setting-tts'),
    // Account & Session
    settingSessionId: document.getElementById('setting-session-id'),
    btnToggleSession: document.getElementById('btn-toggle-session-visibility'),
    btnClearSession: document.getElementById('btn-clear-session'),
    settingAutoConnect: document.getElementById('setting-auto-connect'),
    // Streamer Profiles & OBS Auto-Detect
    btnProfiles: document.getElementById('btn-profiles'),
    modalProfiles: document.getElementById('modal-profiles'),
    btnCloseProfiles: document.getElementById('btn-close-profiles'),
    profilesList: document.getElementById('profiles-list'),
    newProfileInput: document.getElementById('new-profile-input'),
    btnAddProfile: document.getElementById('btn-add-profile'),
    settingObsAutoDetect: document.getElementById('setting-obs-autodetect'),
    obsAutoDetectStatus: document.getElementById('obs-autodetect-status'),
    // Overlay Studio
    btnOverlayStudio: document.getElementById('btn-overlay-studio'),
    modalOverlayStudio: document.getElementById('modal-overlay-studio'),
    btnCloseStudio: document.getElementById('btn-close-studio'),
    studioThemePresets: document.getElementById('studio-theme-presets'),
    studioFontSelect: document.getElementById('studio-font-select'),
    studioSizeSlider: document.getElementById('studio-size-slider'),
    studioSizeVal: document.getElementById('studio-size-val'),
    studioColorBg: document.getElementById('studio-color-bg'),
    studioColorName: document.getElementById('studio-color-name'),
    studioColorText: document.getElementById('studio-color-text'),
    studioAnimSelect: document.getElementById('studio-anim-select'),
    studioFadeSlider: document.getElementById('studio-fade-slider'),
    studioFadeVal: document.getElementById('studio-fade-val'),
    studioToggleAvatar: document.getElementById('studio-toggle-avatar'),
    studioToggleBadges: document.getElementById('studio-toggle-badges'),
    studioGeneratedUrl: document.getElementById('studio-generated-url'),
    btnCopyCustomOverlay: document.getElementById('btn-copy-custom-overlay'),
    btnStudioMockMsg: document.getElementById('btn-studio-mock-msg'),
    studioPreviewFeed: document.getElementById('studio-preview-feed')
  };

  // Helper: Format large numbers (e.g. 15420 -> 15.4K)
  function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    const n = Number(num);
    if (isNaN(n)) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return n.toLocaleString('id-ID');
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // Uptime Clock
  function startUptimeClock() {
    clearInterval(state.uptimeTimer);
    state.uptimeTimer = setInterval(() => {
      if (state.connected) {
        state.stats.uptimeSeconds++;
        el.statusUptime.textContent = formatTime(state.stats.uptimeSeconds);
      }
    }, 1000);
  }

  // WebSocket Connection
  function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      state.ws = new WebSocket(wsUrl);

      state.ws.onopen = () => {
        measurePing();
        const settings = loadSettings();
        // Populate channel input if empty, but NEVER auto-connect on startup!
        if (settings.lastUsername && el.channelInput && !el.channelInput.value) {
          el.channelInput.value = settings.lastUsername;
        }
      };

      state.ws.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          handleIncomingPacket(packet);
        } catch (err) {
          console.error('[strechat] Packet error:', err);
        }
      };

      state.ws.onclose = () => {
        if (!state.isDemo) {
          setTimeout(initWebSocket, 2000);
        }
      };

      state.ws.onerror = () => {
        // handled on close
      };
    } catch (e) {
      setTimeout(initWebSocket, 2500);
    }
  }

  function measurePing() {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify({
        action: 'ping',
        payload: { clientTimestamp: Date.now() }
      }));
    }
    setTimeout(measurePing, 10000);
  }

  function sendWsAction(action, payload = {}) {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify({ action, payload }));
    }
  }

  // Handle packets
  function handleIncomingPacket(packet) {
    const { type, data } = packet;

    switch (type) {
      case 'pong':
        if (packet.clientTimestamp) {
          state.pingMs = Math.max(1, Date.now() - packet.clientTimestamp);
          el.statusPing.textContent = `${state.pingMs}ms`;
        }
        break;

      case 'initial_state':
      case 'status':
        updateConnectionStatus(data);
        break;

      case 'connected':
        state.connected = true;
        setUIConnectedState(true);
        startUptimeClock();
        break;

      case 'disconnected':
        state.connected = false;
        setUIConnectedState(false);
        break;

      case 'reconnecting':
        el.statusDot.className = 'status-dot connecting';
        el.statusText.textContent = `Menyambung ulang (${data.attempt}/${data.maxAttempts})...`;
        break;

      case 'chat':
        if (!state.connected && !state.isDemo) {
          state.connected = true;
          setUIConnectedState(true);
        }
        renderChatMessage(data);
        break;

      case 'gift':
        if (!state.connected && !state.isDemo) {
          state.connected = true;
          setUIConnectedState(true);
        }
        handleGiftEvent(data);
        break;

      case 'like':
        if (!state.connected && !state.isDemo) {
          state.connected = true;
          setUIConnectedState(true);
        }
        handleLikeEvent(data);
        break;

      case 'viewers':
        if (!state.connected && !state.isDemo) {
          state.connected = true;
          setUIConnectedState(true);
        }
        state.stats.viewerCount = data.viewerCount;
        state.stats.peakViewers = data.peakViewers;
        el.metricViewers.textContent = formatNumber(data.viewerCount);
        el.metricPeak.textContent = `Puncak: ${formatNumber(data.peakViewers)}`;
        break;

      case 'stats_update':
        if (data && data.stats) {
          if (!state.connected && !state.isDemo && data.status === 'CONNECTED') {
            state.connected = true;
            setUIConnectedState(true);
          }
          syncStats(data.stats);
        }
        break;

      case 'error':
        showNotification(data?.message || 'Terjadi kesalahan pada live stream', 'error');
        setUIConnectedState(false);
        break;

      case 'streamEnd':
        showNotification('Live stream telah selesai.', 'info');
        setUIConnectedState(false);
        break;

      default:
        break;
    }
  }

  function updateConnectionStatus(data) {
    if (!data) return;
    state.status = data.status || 'DISCONNECTED';
    state.uniqueId = data.uniqueId || '';

    if (data.status === 'CONNECTED') {
      state.connected = true;
      setUIConnectedState(true);
      if (data.stats) syncStats(data.stats);
    } else if (data.status === 'CONNECTING') {
      el.statusDot.className = 'status-dot connecting';
      el.statusText.textContent = 'Menghubungkan...';
    } else {
      state.connected = false;
      setUIConnectedState(false);
    }
  }

  function syncStats(stats) {
    state.stats.viewerCount = stats.viewerCount || 0;
    state.stats.peakViewers = stats.peakViewers || 0;
    state.stats.totalLikes = stats.totalLikes || 0;
    state.stats.totalDiamonds = stats.totalDiamonds || 0;
    state.stats.totalGifts = stats.totalGifts || 0;
    state.stats.totalComments = stats.totalComments || 0;
    if (stats.uptimeSeconds !== undefined) {
      state.stats.uptimeSeconds = stats.uptimeSeconds;
    }

    el.metricViewers.textContent = formatNumber(state.stats.viewerCount);
    el.metricPeak.textContent = `Puncak: ${formatNumber(state.stats.peakViewers)}`;
    el.metricLikes.textContent = formatNumber(state.stats.totalLikes);
    el.metricDiamonds.textContent = formatNumber(state.stats.totalDiamonds);
    el.metricComments.textContent = formatNumber(state.stats.totalComments);

    const indPeak = document.getElementById('ind-peak-val');
    if (indPeak) indPeak.textContent = formatNumber(state.stats.peakViewers);

    const indDiamond = document.getElementById('ind-diamond-val');
    if (indDiamond) indDiamond.textContent = `💎 ${formatNumber(state.stats.totalDiamonds)}`;

    const heroLikes = document.getElementById('hero-likes-val');
    if (heroLikes) heroLikes.textContent = formatNumber(state.stats.totalLikes);
  }

  function setUIConnectedState(isConnected) {
    const heroStreamer = document.getElementById('hero-streamer-name');
    if (heroStreamer) {
      heroStreamer.textContent = isConnected ? `@${state.uniqueId || 'host'}` : 'Belum Terhubung';
    }

    if (isConnected) {
      el.statusDot.className = 'status-dot connected';
      el.statusText.textContent = `Terhubung: @${state.uniqueId || 'host'}`;
      el.btnConnect.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        Putuskan
      `;
      el.btnConnect.classList.add('btn-danger');
      el.channelInput.disabled = true;
      if (el.chatEmpty) el.chatEmpty.style.display = 'none';
      stopObsAutoDetect();
    } else {
      const targetUser = (el.channelInput?.value || loadSettings().lastUsername || '').trim().replace(/^@+/, '');
      if (state.obsAutoDetect && !state.manuallyDisconnected && targetUser) {
        el.statusDot.className = 'status-dot standby';
        el.statusText.textContent = `Standby OBS: @${targetUser}`;
      } else {
        el.statusDot.className = 'status-dot disconnected';
        el.statusText.textContent = 'Terputus';
      }
      el.statusUptime.textContent = '00:00';
      el.btnConnect.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        Mulai Pantau
      `;
      el.btnConnect.classList.remove('btn-danger');
      el.channelInput.disabled = false;
    }
  }

  // Render Chat Item
  function renderChatMessage(chat) {
    if (el.chatEmpty) el.chatEmpty.style.display = 'none';

    const item = document.createElement('div');
    item.className = 'chat-item';
    item.dataset.id = chat.id;
    item.dataset.user = chat.uniqueId;
    item.dataset.isQuestion = chat.comment.includes('?') ? 'true' : 'false';
    item.dataset.isMod = chat.isModerator ? 'true' : 'false';

    // Avatar
    let avatarHtml = '';
    if (chat.profilePictureUrl && chat.profilePictureUrl.startsWith('http')) {
      avatarHtml = `<img class="chat-avatar" src="${chat.profilePictureUrl}" alt="${chat.nickname}" onerror="this.outerHTML='<div class=\\'chat-avatar-placeholder\\'>${chat.nickname.charAt(0).toUpperCase()}</div>'">`;
    } else {
      avatarHtml = `<div class="chat-avatar-placeholder">${chat.nickname.charAt(0).toUpperCase()}</div>`;
    }

    // Badges
    let badgesHtml = '';
    if (chat.isModerator) {
      badgesHtml += `<span class="badge-item badge-moderator">MOD</span>`;
    }
    if (chat.isSubscriber) {
      badgesHtml += `<span class="badge-item badge-subscriber">SUB</span>`;
    }

    const timeString = new Date(chat.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const filteredComment = filterBannedWords(chat.comment);

    item.innerHTML = `
      ${avatarHtml}
      <div class="chat-body">
        <div class="chat-header">
          <span class="chat-nickname" title="@${chat.uniqueId}">${chat.nickname}</span>
          ${badgesHtml}
          <span class="chat-time">${timeString}</span>
        </div>
        <div class="chat-text">${filteredComment}</div>
      </div>
      <div class="chat-actions">
        <button class="chat-action-btn btn-pin-item" title="Sematkan Pesan">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: -1px; margin-right: 3px;"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>Pin
        </button>
      </div>
    `;

    // Pin click handler
    const btnPinItem = item.querySelector('.btn-pin-item');
    if (btnPinItem) {
      btnPinItem.addEventListener('click', (e) => {
        e.stopPropagation();
        pinMessage(chat.nickname, filteredComment);
      });
    }

    applyItemFilter(item);
    el.chatContainer.appendChild(item);

    // Limit buffer to preserve 60fps
    if (el.chatContainer.children.length > 300) {
      el.chatContainer.removeChild(el.chatContainer.firstElementChild);
    }

    if (state.isAutoScroll) {
      el.chatContainer.scrollTop = el.chatContainer.scrollHeight;
    }
  }

  // Like Event
  function handleLikeEvent(data) {
    state.stats.totalLikes += (Number(data.likeCount) || 1);
    el.metricLikes.textContent = formatNumber(state.stats.totalLikes);

    const heroLikes = document.getElementById('hero-likes-val');
    if (heroLikes) heroLikes.textContent = formatNumber(state.stats.totalLikes);

    const heartIcon = document.querySelector('.hero-stat-pill .pill-icon.likes svg, .metric-card.likes svg');
    if (heartIcon) {
      heartIcon.classList.remove('heart-pulse');
      void heartIcon.offsetWidth;
      heartIcon.classList.add('heart-pulse');
    }
  }

  // Gift Event & Smart Floating Banner (Max 2 Banners + Inline Chat Entry)
  function handleGiftEvent(data) {
    const gift = data.gift;
    const diamonds = gift.diamondCount * (data.repeatEnd ? data.repeatCount : 1);
    state.stats.totalDiamonds += diamonds;
    state.stats.totalGifts += (data.repeatEnd ? data.repeatCount : 1);

    el.metricDiamonds.textContent = formatNumber(state.stats.totalDiamonds);
    const indDia = document.getElementById('ind-diamond-val');
    if (indDia) indDia.textContent = `💎 ${formatNumber(state.stats.totalDiamonds)}`;

    // Audio chime
    if (window.soundEngine) {
      const intensity = gift.diamondCount > 50 ? 3 : gift.diamondCount > 5 ? 2 : 1;
      window.soundEngine.playGiftChime(intensity);
    }

    // TTS
    if (window.ttsEngine) {
      window.ttsEngine.speakGift(data.nickname, gift.giftName, data.repeatCount);
    }

    // Render into chat feed as a stylish gift row
    if (data.repeatEnd || data.repeatCount === 1) {
      renderInlineGift(data, diamonds);
      loadAnalyticsData();
    }

    // Floating Banner Pooling: Update existing combo or show max 2 compact badges in top-left
    const giftKey = `${data.uniqueId || data.nickname}_${gift.giftName}`;
    const existing = el.giftBannerArea ? el.giftBannerArea.querySelector(`[data-gift-key="${giftKey}"]`) : null;
    const safeNick = escapeHtml(data.nickname || 'Pengguna');
    const safeGiftName = escapeHtml(gift.giftName || 'Gift');

    if (existing) {
      const badge = existing.querySelector('.gift-combo-badge');
      if (badge) {
        badge.textContent = `x${data.repeatCount}`;
        badge.classList.remove('heart-pulse');
        void badge.offsetWidth;
        badge.classList.add('heart-pulse');
      }
      const desc = existing.querySelector('.gift-desc');
      if (desc) {
        desc.innerHTML = `Mengirim <strong>${safeGiftName}</strong> (${diamonds} Diamond)`;
      }
      clearTimeout(existing._timer);
      existing._timer = setTimeout(() => {
        existing.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
        existing.style.opacity = '0';
        existing.style.transform = 'translateY(-6px)';
        setTimeout(() => existing.remove(), 250);
      }, 2800);
    } else if (el.giftBannerArea) {
      // Keep at most 2 compact banners in top-left corner
      while (el.giftBannerArea.children.length >= 2) {
        el.giftBannerArea.removeChild(el.giftBannerArea.firstElementChild);
      }

      const banner = document.createElement('div');
      banner.className = 'gift-banner';
      banner.dataset.giftKey = giftKey;

      let avatarSrc = data.profilePictureUrl && data.profilePictureUrl.startsWith('http')
        ? `<img class="gift-avatar" src="${escapeHtml(data.profilePictureUrl)}" alt="${safeNick}">`
        : `<div class="gift-avatar-placeholder">${safeNick.charAt(0).toUpperCase()}</div>`;

      let giftImg = gift.giftPictureUrl
        ? `<img class="gift-icon-img" src="${escapeHtml(gift.giftPictureUrl)}" alt="${safeGiftName}">`
        : `<svg class="gift-icon-img" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line></svg>`;

      const comboHtml = data.repeatCount > 1
        ? `<span class="gift-combo-badge">x${data.repeatCount}</span>`
        : '';

      banner.innerHTML = `
        <div class="gift-banner-left">
          ${avatarSrc}
          <div class="gift-info">
            <span class="gift-sender">${safeNick}</span>
            <span class="gift-desc">Mengirim <strong>${safeGiftName}</strong> (${diamonds} Diamond)</span>
          </div>
        </div>
        <div class="gift-banner-right">
          ${giftImg}
          ${comboHtml}
        </div>
      `;

      el.giftBannerArea.appendChild(banner);

      banner._timer = setTimeout(() => {
        banner.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
        banner.style.opacity = '0';
        banner.style.transform = 'translateY(-6px)';
        setTimeout(() => banner.remove(), 250);
      }, 2800);
    }
  }

  // Render Compact Inline Gift Message in Main Chat Feed
  function renderInlineGift(data, diamonds) {
    if (el.chatEmpty) el.chatEmpty.style.display = 'none';

    const item = document.createElement('div');
    item.className = 'chat-item chat-item-gift';
    item.dataset.id = data.id;
    item.dataset.user = data.uniqueId;
    item.dataset.isGift = 'true';
    item.dataset.isQuestion = 'false';
    item.dataset.isMod = 'false';

    const safeNick = escapeHtml(data.nickname || 'Pengguna');
    const safeGiftName = escapeHtml(data.gift?.giftName || 'Gift');

    let avatarHtml = '';
    if (data.profilePictureUrl && data.profilePictureUrl.startsWith('http')) {
      avatarHtml = `<img class="chat-avatar" src="${escapeHtml(data.profilePictureUrl)}" alt="${safeNick}">`;
    } else {
      avatarHtml = `<div class="chat-avatar-placeholder">${safeNick.charAt(0).toUpperCase()}</div>`;
    }

    let giftImg = data.gift?.giftPictureUrl
      ? `<img src="${escapeHtml(data.gift.giftPictureUrl)}" style="width: 20px; height: 20px; vertical-align: middle; margin-left: 4px; object-fit: contain;" alt="">`
      : '';

    const timeString = new Date(data.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    item.innerHTML = `
      ${avatarHtml}
      <div class="chat-body">
        <div class="chat-header">
          <span class="chat-nickname">${safeNick}</span>
          <span class="badge-item badge-gift">GIFT</span>
          <span class="chat-time">${timeString}</span>
        </div>
        <div class="chat-text gift-highlight">
          Mengirim <strong>${safeGiftName}</strong> (${diamonds} Diamond) ${data.repeatCount > 1 ? 'x' + data.repeatCount : ''} ${giftImg}
        </div>
      </div>
    `;

    applyItemFilter(item);
    el.chatContainer.appendChild(item);

    if (el.chatContainer.children.length > 300) {
      el.chatContainer.removeChild(el.chatContainer.firstElementChild);
    }

    if (state.isAutoScroll) {
      el.chatContainer.scrollTop = el.chatContainer.scrollHeight;
    }
  }

  // Pin Message
  function pinMessage(author, text) {
    state.pinnedMessage = { author, text };
    el.pinnedAuthor.textContent = author + ':';
    el.pinnedText.textContent = text;
    el.pinnedContainer.style.display = 'flex';
  }

  function dismissPin() {
    state.pinnedMessage = null;
    el.pinnedContainer.style.display = 'none';
  }

  // Filter application
  function applyItemFilter(item) {
    const isGift = item.dataset.isGift === 'true';
    const text = item.textContent.toLowerCase();

    let matchesFilter = true;
    if (state.filter === 'gifts' && !isGift) matchesFilter = false;

    let matchesSearch = true;
    if (state.searchQuery && !text.includes(state.searchQuery)) {
      matchesSearch = false;
    }

    item.style.display = matchesFilter && matchesSearch ? 'flex' : 'none';
  }

  function reapplyAllFilters() {
    const items = el.chatContainer.querySelectorAll('.chat-item');
    items.forEach(applyItemFilter);
  }

  // Notifications
  function showNotification(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'error' ? '#e11d48' : '#4f46e5'};
      color: #fff;
      padding: 10px 18px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 500;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      z-index: 999;
      animation: slideInUp 0.3s ease;
      display: flex;
      align-items: center;
      gap: 6px;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Analytics & Export Helpers (P4)
  async function loadAnalyticsData() {
    try {
      const res = await fetch('/api/session/current');
      const data = await res.json();
      const summary = data.summary || {};

      const durationEl = document.getElementById('analytics-duration');
      if (durationEl) durationEl.textContent = formatTime(summary.durationSeconds || 0);

      const peakEl = document.getElementById('analytics-peak');
      if (peakEl) peakEl.textContent = formatNumber(summary.peakViewers || 0);

      const avgEl = document.getElementById('analytics-avg');
      if (avgEl) avgEl.textContent = formatNumber(summary.averageViewers || 0);

      const totalDiaEl = document.getElementById('analytics-total-diamonds');
      if (totalDiaEl) totalDiaEl.textContent = `${formatNumber(summary.totalDiamonds || 0)} Diamond`;

      // Update Mini Dashboard Leaderboard
      const miniEl = document.getElementById('mini-leaderboard');
      if (miniEl) {
        if (!data.topGifters || data.topGifters.length === 0) {
          miniEl.innerHTML = `
            <div class="leaderboard-empty" style="text-align: center; padding: 24px 10px; color: var(--text-muted); font-size: 12px;">
              Belum ada gift yang masuk pada sesi ini.
            </div>
          `;
        } else {
          miniEl.innerHTML = data.topGifters.slice(0, 5).map((g, idx) => {
            const avatarHtml = g.avatar
              ? `<img src="${g.avatar}" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover;" onerror="this.outerHTML='<div class=\\'donor-rank\\'>${(g.nickname || 'U')[0].toUpperCase()}</div>'">`
              : `<div class="donor-rank rank-${idx + 1}">${idx + 1}</div>`;

            return `
              <div class="leaderboard-mini-item">
                <div class="donor-left">
                  ${avatarHtml}
                  <span class="donor-name">${escapeHtml(g.nickname)}</span>
                </div>
                <span class="donor-diamonds">💎 ${formatNumber(g.diamonds)}</span>
              </div>
            `;
          }).join('');
        }
      }

      const listEl = document.getElementById('leaderboard-list');
      if (!listEl) return;

      if (!data.topGifters || data.topGifters.length === 0) {
        listEl.innerHTML = `
          <div style="text-align: center; padding: 16px; color: var(--text-muted); font-size: 12px;">
            Belum ada gift yang masuk pada sesi live ini.
          </div>
        `;
        return;
      }

      const rankColors = ['#f59e0b', '#94a3b8', '#d97706', '#64748b', '#475569'];
      listEl.innerHTML = data.topGifters.map((g, idx) => {
        const color = rankColors[idx] || '#64748b';
        const avatarHtml = g.avatar
          ? `<img src="${g.avatar}" class="gift-avatar" style="width: 24px; height: 24px; border-radius: 50%;" onerror="this.style.display='none'">`
          : `<div class="gift-avatar-placeholder" style="width: 24px; height: 24px; font-size: 10px;">${(g.nickname || 'U')[0].toUpperCase()}</div>`;

        return `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid var(--border-subtle);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 700; font-size: 11px; width: 16px; text-align: center; color: ${color};">#${idx + 1}</span>
              ${avatarHtml}
              <div style="display: flex; flex-direction: column;">
                <span style="font-weight: 600; font-size: 12px; color: var(--text-primary);">${g.nickname}</span>
                <span style="font-size: 10px; color: var(--text-muted);">${g.giftCount}x gift</span>
              </div>
            </div>
            <span style="font-weight: 700; font-size: 11px; color: var(--accent-amber); display: flex; align-items: center; gap: 4px;">
              ${formatNumber(g.diamonds)}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 2 8.5 12 22 22 8.5 12 2"></polygon><line x1="2" y1="8.5" x2="22" y2="8.5"></line></svg>
            </span>
          </div>
        `;
      }).join('');
    } catch (e) {
      console.warn('[strechat] Gagal memuat data analytics:', e);
    }
  }

  async function downloadExport(format) {
    try {
      const res = await fetch(`/api/session/export?format=${format}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `strechat-session-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showNotification(`Laporan ${format.toUpperCase()} berhasil diunduh`, 'info');
    } catch (e) {
      showNotification(`Gagal mengunduh laporan ${format.toUpperCase()}`, 'error');
    }
  }

  // Fetch Server & Network Info
  async function loadServerInfo() {
    try {
      const res = await fetch('/api/info');
      if (res.ok) {
        const info = await res.json();
        const base = `http://localhost:${info.port || 3000}`;
        const obsOverlayEl = document.getElementById('obs-overlay-url');
        const obsDockEl = document.getElementById('obs-dock-url');
        if (obsOverlayEl) obsOverlayEl.textContent = `${base}/overlay`;
        if (obsDockEl) obsDockEl.textContent = base;
        if (el.remoteUrlText) {
          el.remoteUrlText.textContent = info.remoteUrl;
        }
      }
    } catch (e) {}
  }

  // Connect directly to a TikTok streamer room
  function connectToTikTok(targetUsername) {
    const username = (targetUsername || el.channelInput.value || '').trim().replace(/^@+/, '');
    if (!username) return;
    el.channelInput.value = username;
    const settings = loadSettings();
    const sessionId = settings.sessionId || '';
    sendWsAction('connect', { username, sessionId });
    saveSettings({ lastUsername: username });
    addProfile(username);
    el.statusDot.className = 'status-dot connecting';
    el.statusText.textContent = 'Menghubungkan...';
  }

  // Auto-Detect OBS Studio Live Session
  function startObsAutoDetect() {
    stopObsAutoDetect();
    if (!state.obsAutoDetect || state.manuallyDisconnected) return;

    const check = async () => {
      if (state.connected || state.status === 'CONNECTED' || state.status === 'CONNECTING' || state.isCheckingLive || state.manuallyDisconnected) {
        return;
      }

      const username = (el.channelInput?.value || loadSettings().lastUsername || '').trim().replace(/^@+/, '');
      if (!username) {
        updateAutoDetectStatusUI(false, 'Masukkan username target untuk auto-detect OBS');
        return;
      }

      updateAutoDetectStatusUI(true, `Standby: Menunggu siaran @${username} dimulai di OBS Studio...`);

      if (!state.connected && state.status !== 'CONNECTING' && !state.manuallyDisconnected) {
        el.statusDot.className = 'status-dot standby';
        el.statusText.textContent = `Standby OBS: @${username}`;
      }

      state.isCheckingLive = true;
      try {
        const res = await fetch(`/api/check-live?username=${encodeURIComponent(username)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.isLive && !state.connected && state.status !== 'CONNECTING' && !state.manuallyDisconnected) {
            console.log(`[strechat] Siaran OBS untuk @${username} terdeteksi LIVE! Menghubungkan...`);
            showNotification(`🟢 Siaran OBS Terdeteksi! Menghubungkan ke @${username}...`, 'success');
            connectToTikTok(username);
          }
        }
      } catch (err) {
        // Silently retry on next tick
      } finally {
        state.isCheckingLive = false;
      }
    };

    state.obsAutoDetectTimer = setInterval(check, 8000);
  }

  function stopObsAutoDetect() {
    if (state.obsAutoDetectTimer) {
      clearInterval(state.obsAutoDetectTimer);
      state.obsAutoDetectTimer = null;
    }
  }

  function updateAutoDetectStatusUI(active, text) {
    if (!el.obsAutoDetectStatus) return;
    if (active) {
      el.obsAutoDetectStatus.innerHTML = `
        <span class="status-dot connected" style="width: 6px; height: 6px;"></span>
        <span>${escapeHtml(text)}</span>
      `;
      el.obsAutoDetectStatus.style.color = 'var(--accent-lime)';
    } else {
      el.obsAutoDetectStatus.innerHTML = `
        <span class="status-dot disconnected" style="width: 6px; height: 6px;"></span>
        <span>${escapeHtml(text)}</span>
      `;
      el.obsAutoDetectStatus.style.color = 'var(--text-muted)';
    }
  }

  // Event Listeners
  function setupEventListeners() {
    // Connect / Disconnect Button
    el.btnConnect.addEventListener('click', () => {
      if (state.connected || state.status === 'CONNECTING') {
        state.manuallyDisconnected = true;
        stopObsAutoDetect();
        state.obsAutoDetect = false;
        saveSettings({ obsAutoDetect: false, autoConnect: false });
        if (el.settingObsAutoDetect) el.settingObsAutoDetect.checked = false;
        if (el.settingAutoConnect) el.settingAutoConnect.checked = false;
        updateAutoDetectStatusUI(false, 'Auto-detect nonaktif (mode manual)');

        if (state.isDemo) {
          window.demoEngine.stop();
          state.isDemo = false;
          el.btnDemo.classList.remove('active');
          state.connected = false;
          state.status = 'DISCONNECTED';
          setUIConnectedState(false);
          showNotification('Simulasi demo dihentikan', 'info');
          return;
        }

        sendWsAction('disconnect');

        state.connected = false;
        state.status = 'DISCONNECTED';
        setUIConnectedState(false);
        showNotification('Koneksi TikTok berhasil dihentikan.', 'info');
      } else {
        state.manuallyDisconnected = false;
        const username = el.channelInput.value.trim().replace(/^@+/, '');
        if (!username) {
          showNotification('Masukkan username TikTok terlebih dahulu', 'error');
          el.channelInput.focus();
          return;
        }
        saveSettings({ lastUsername: username });
        connectToTikTok(username);
      }
    });

    el.channelInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        el.btnConnect.click();
      }
    });

    // Demo Mode Toggle
    el.btnDemo.addEventListener('click', () => {
      if (state.isDemo) {
        window.demoEngine.stop();
        state.isDemo = false;
        el.btnDemo.classList.remove('active');
        setUIConnectedState(false);
        showNotification('Demo mode nonaktif.', 'info');
      } else {
        state.isDemo = true;
        el.btnDemo.classList.add('active');
        setUIConnectedState(true);
        state.uniqueId = 'demo_streamer';
        showNotification('Demo mode aktif (simulasi data stream).', 'info');
        window.demoEngine.start((type, data) => {
          handleIncomingPacket({ type, data, timestamp: Date.now() });
        });
      }
    });

    // Chat Scroll Behavior
    el.chatContainer.addEventListener('scroll', () => {
      const isAtBottom = el.chatContainer.scrollHeight - el.chatContainer.scrollTop - el.chatContainer.clientHeight < 40;
      state.isAutoScroll = isAtBottom;
      el.btnScrollBottom.style.display = isAtBottom ? 'none' : 'flex';
    });

    el.btnScrollBottom.addEventListener('click', () => {
      state.isAutoScroll = true;
      el.chatContainer.scrollTop = el.chatContainer.scrollHeight;
      el.btnScrollBottom.style.display = 'none';
    });

    // Dismiss Pin
    el.btnDismissPin.addEventListener('click', dismissPin);

    // Filters
    el.filterPills.forEach((btn) => {
      btn.addEventListener('click', () => {
        el.filterPills.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.filter = btn.dataset.filter;
        reapplyAllFilters();
      });
    });

    // Search
    el.chatSearchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.toLowerCase().trim();
      reapplyAllFilters();
    });

    // Theme Toggle
    el.btnTheme.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem('strechat_theme', nextTheme);
    });

    // Settings Modal
    el.btnSettings.addEventListener('click', () => {
      loadServerInfo();
      el.modalSettings.classList.add('open');
    });

    // Analytics & Leaderboard Modal (P4)
    const btnAnalytics = document.getElementById('btn-analytics');
    const modalAnalytics = document.getElementById('modal-analytics');
    const btnCloseAnalytics = document.getElementById('btn-close-analytics');

    if (btnAnalytics && modalAnalytics) {
      btnAnalytics.addEventListener('click', () => {
        loadAnalyticsData();
        modalAnalytics.classList.add('open');
      });
      if (btnCloseAnalytics) {
        btnCloseAnalytics.addEventListener('click', () => {
          modalAnalytics.classList.remove('open');
        });
      }
      modalAnalytics.addEventListener('click', (e) => {
        if (e.target === modalAnalytics) {
          modalAnalytics.classList.remove('open');
        }
      });
    }

    const btnExportCsv = document.getElementById('btn-export-csv');
    if (btnExportCsv) {
      btnExportCsv.addEventListener('click', (e) => {
        e.preventDefault();
        downloadExport('csv');
      });
    }

    const btnExportJson = document.getElementById('btn-export-json');
    if (btnExportJson) {
      btnExportJson.addEventListener('click', (e) => {
        e.preventDefault();
        downloadExport('json');
      });
    }

    const btnQuitApp = document.getElementById('btn-quit-app');
    if (btnQuitApp) {
      btnQuitApp.addEventListener('click', () => {
        if (window.electronAPI && window.electronAPI.isElectron) {
          if (typeof window.electronAPI.quit === 'function') {
            window.electronAPI.quit();
          } else {
            window.electronAPI.close();
          }
        } else {
          if (state.connected) sendWsAction('disconnect');
          window.close();
          showNotification('Silakan tutup tab browser Anda untuk keluar.', 'info');
        }
      });
    }

    // Dashboard Card Quick Action Buttons
    const btnQuickStudio = document.getElementById('btn-quick-studio');
    if (btnQuickStudio) {
      btnQuickStudio.addEventListener('click', () => {
        if (el.btnOverlayStudio) el.btnOverlayStudio.click();
      });
    }

    const btnOpenAnalyticsModal = document.getElementById('btn-open-analytics-modal');
    if (btnOpenAnalyticsModal) {
      btnOpenAnalyticsModal.addEventListener('click', () => {
        if (el.btnAnalytics) el.btnAnalytics.click();
      });
    }

    const btnDashExportCsv = document.getElementById('btn-dash-export-csv');
    if (btnDashExportCsv) {
      btnDashExportCsv.addEventListener('click', () => downloadExport('csv'));
    }

    const btnDashExportJson = document.getElementById('btn-dash-export-json');
    if (btnDashExportJson) {
      btnDashExportJson.addEventListener('click', () => downloadExport('json'));
    }

    el.btnCloseSettings.addEventListener('click', () => {
      el.modalSettings.classList.remove('open');
    });

    el.modalSettings.addEventListener('click', (e) => {
      if (e.target === el.modalSettings) {
        el.modalSettings.classList.remove('open');
      }
    });

    // Copy remote LAN URL
    el.btnCopyRemote.addEventListener('click', () => {
      const url = el.remoteUrlText.textContent;
      navigator.clipboard.writeText(url).then(() => {
        showNotification('Tautan remote berhasil disalin', 'info');
      });
    });

    const btnCopyOverlay = document.getElementById('btn-copy-overlay');
    if (btnCopyOverlay) {
      btnCopyOverlay.addEventListener('click', () => {
        const url = document.getElementById('obs-overlay-url')?.textContent || 'http://localhost:3000/overlay';
        navigator.clipboard.writeText(url).then(() => {
          showNotification('Tautan Overlay Transparan OBS berhasil disalin!', 'info');
        });
      });
    }

    const btnCopyDock = document.getElementById('btn-copy-dock');
    if (btnCopyDock) {
      btnCopyDock.addEventListener('click', () => {
        const url = document.getElementById('obs-dock-url')?.textContent || 'http://localhost:3000';
        navigator.clipboard.writeText(url).then(() => {
          showNotification('Tautan OBS Dock berhasil disalin!', 'info');
        });
      });
    }

    // Sound and TTS toggles with persistence
    el.settingSound.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      if (window.soundEngine) {
        window.soundEngine.enabled = isChecked;
      }
      saveSettings({ soundEnabled: isChecked });
    });

    el.settingTts.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      if (window.ttsEngine) {
        window.ttsEngine.enabled = isChecked;
      }
      saveSettings({ ttsEnabled: isChecked });
    });

    // Clear Chat DOM Feed (P3.2)
    const btnClearChat = document.getElementById('btn-clear-chat');
    if (btnClearChat) {
      btnClearChat.addEventListener('click', () => {
        const items = el.chatContainer.querySelectorAll('.chat-item, .chat-item-gift');
        items.forEach(i => i.remove());
        if (el.chatEmpty) {
          el.chatEmpty.style.display = 'flex';
          const h3 = el.chatEmpty.querySelector('h3');
          if (h3) h3.textContent = 'Obrolan Telah Dibersihkan';
          const p = el.chatEmpty.querySelector('p');
          if (p) p.textContent = 'Komentar baru akan otomatis muncul di sini saat penonton mengirim pesan.';
        }
        showNotification('Riwayat obrolan di layar telah dibersihkan', 'info');
      });
    }

    // Chat Font Size Selector (P3.3)
    const fontSizeBtns = document.querySelectorAll('.font-size-btn');
    fontSizeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const size = btn.dataset.size;
        applyChatFontSize(size);
        saveSettings({ chatFontSize: size });
      });
    });

    // Chat Blacklist Filter
    const settingBlacklist = document.getElementById('setting-blacklist');
    if (settingBlacklist) {
      settingBlacklist.addEventListener('input', (e) => {
        const val = e.target.value;
        updateBannedWordsList(val);
        saveSettings({ bannedWords: val });
      });
    }

    // Window controls (Electron Native & Browser Fallback)
    if (el.btnClose) {
      el.btnClose.addEventListener('click', () => {
        if (window.electronAPI && window.electronAPI.isElectron) {
          window.electronAPI.close();
        } else {
          if (state.connected) sendWsAction('disconnect');
          window.close();
          showNotification('Untuk keluar, silakan tutup tab atau jendela browser ini.', 'info');
        }
      });
    }

    if (el.btnMin) {
      el.btnMin.addEventListener('click', () => {
        if (window.electronAPI && window.electronAPI.isElectron) {
          window.electronAPI.minimize();
        }
      });
    }

    if (el.btnMax) {
      el.btnMax.addEventListener('click', () => {
        if (window.electronAPI && window.electronAPI.isElectron) {
          window.electronAPI.maximize();
        } else {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
        }
      });
    }

    if (el.btnPin) {
      el.btnPin.addEventListener('click', () => {
        state.isAlwaysOnTop = !state.isAlwaysOnTop;
        if (window.electronAPI && window.electronAPI.isElectron) {
          window.electronAPI.setAlwaysOnTop(state.isAlwaysOnTop);
        }
        el.btnPin.classList.toggle('pinned', state.isAlwaysOnTop);
        showNotification(state.isAlwaysOnTop ? 'Mode Pin aktif (Selalu di atas)' : 'Mode Pin nonaktif', 'info');
      });
    }

    // Account & Secure Session ID
    if (el.settingSessionId) {
      el.settingSessionId.addEventListener('input', (e) => {
        saveSettings({ sessionId: e.target.value.trim() });
      });
    }

    if (el.btnToggleSession && el.settingSessionId) {
      el.btnToggleSession.addEventListener('click', () => {
        const isPass = el.settingSessionId.type === 'password';
        el.settingSessionId.type = isPass ? 'text' : 'password';
      });
    }

    if (el.btnClearSession && el.settingSessionId) {
      el.btnClearSession.addEventListener('click', () => {
        el.settingSessionId.value = '';
        saveSettings({ sessionId: '' });
        showNotification('Session ID telah dihapus', 'info');
      });
    }

    if (el.settingAutoConnect) {
      el.settingAutoConnect.addEventListener('change', (e) => {
        saveSettings({ autoConnect: e.target.checked });
      });
    }

    // Streamer Profiles Modal
    if (el.btnProfiles && el.modalProfiles) {
      el.btnProfiles.addEventListener('click', () => {
        renderProfiles();
        el.modalProfiles.classList.add('open');
      });
    }

    if (el.btnCloseProfiles && el.modalProfiles) {
      el.btnCloseProfiles.addEventListener('click', () => {
        el.modalProfiles.classList.remove('open');
      });
    }

    if (el.modalProfiles) {
      el.modalProfiles.addEventListener('click', (e) => {
        if (e.target === el.modalProfiles) {
          el.modalProfiles.classList.remove('open');
        }
      });
    }

    if (el.btnAddProfile && el.newProfileInput) {
      const handleAddProfile = () => {
        const val = el.newProfileInput.value.trim().replace(/^@+/, '');
        if (!val) {
          showNotification('Ketik username TikTok terlebih dahulu', 'error');
          return;
        }
        addProfile(val);
        el.channelInput.value = val;
        saveSettings({ lastUsername: val });
        el.newProfileInput.value = '';
        renderProfiles();
        if (state.obsAutoDetect) {
          startObsAutoDetect();
        }
        showNotification(`Profil @${val} disimpan & aktif untuk OBS`, 'success');
      };

      el.btnAddProfile.addEventListener('click', handleAddProfile);
      el.newProfileInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAddProfile();
      });
    }

    if (el.settingObsAutoDetect) {
      el.settingObsAutoDetect.addEventListener('change', (e) => {
        state.obsAutoDetect = e.target.checked;
        saveSettings({ obsAutoDetect: state.obsAutoDetect });
        if (state.obsAutoDetect) {
          startObsAutoDetect();
          showNotification('Auto-Detect Siaran OBS diaktifkan', 'success');
        } else {
          stopObsAutoDetect();
          updateAutoDetectStatusUI(false, 'Auto-detect nonaktif (mode koneksi manual)');
          if (!state.connected && state.status === 'DISCONNECTED') {
            el.statusDot.className = 'status-dot disconnected';
            el.statusText.textContent = 'Terputus';
          }
          showNotification('Auto-Detect Siaran OBS dinonaktifkan', 'info');
        }
      });
    }

    if (el.channelInput) {
      el.channelInput.addEventListener('input', () => {
        const val = el.channelInput.value.trim().replace(/^@+/, '');
        if (val) {
          saveSettings({ lastUsername: val });
          if (state.obsAutoDetect) {
            startObsAutoDetect();
          }
        }
      });
    }

    // Overlay Studio Modal & Controls
    if (el.btnOverlayStudio && el.modalOverlayStudio) {
      el.btnOverlayStudio.addEventListener('click', () => {
        updateStudioPreview();
        if (el.studioPreviewFeed && el.studioPreviewFeed.children.length === 0) {
          spawnStudioMockMessage();
        }
        el.modalOverlayStudio.classList.add('open');
      });
    }

    if (el.btnCloseStudio && el.modalOverlayStudio) {
      el.btnCloseStudio.addEventListener('click', () => {
        el.modalOverlayStudio.classList.remove('open');
      });
    }

    if (el.modalOverlayStudio) {
      el.modalOverlayStudio.addEventListener('click', (e) => {
        if (e.target === el.modalOverlayStudio) {
          el.modalOverlayStudio.classList.remove('open');
        }
      });
    }

    if (el.studioThemePresets) {
      const themeBtns = el.studioThemePresets.querySelectorAll('.pill-btn');
      themeBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          themeBtns.forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          const t = btn.dataset.theme;
          studioState.theme = t;
          const def = THEME_DEFAULTS[t] || THEME_DEFAULTS.pixel;
          studioState.bg = def.bg;
          studioState.nameColor = def.nameColor;
          studioState.textColor = def.textColor;

          if (el.studioColorBg && !def.bg.startsWith('rgba') && def.bg !== 'transparent') {
            el.studioColorBg.value = def.bg;
          }
          if (el.studioColorName) el.studioColorName.value = def.nameColor;
          if (el.studioColorText) el.studioColorText.value = def.textColor;

          if (el.studioPreviewFeed) {
            el.studioPreviewFeed.innerHTML = '';
          }
          updateStudioPreview();
          spawnStudioMockMessage();
        });
      });
    }

    if (el.studioFontSelect) {
      el.studioFontSelect.addEventListener('change', (e) => {
        studioState.font = e.target.value;
        updateStudioPreview();
      });
    }

    if (el.studioSizeSlider && el.studioSizeVal) {
      el.studioSizeSlider.addEventListener('input', (e) => {
        studioState.size = Number(e.target.value);
        el.studioSizeVal.textContent = e.target.value;
        updateStudioPreview();
      });
    }

    if (el.studioColorBg) {
      el.studioColorBg.addEventListener('input', (e) => {
        studioState.bg = e.target.value;
        updateStudioPreview();
      });
    }

    if (el.studioColorName) {
      el.studioColorName.addEventListener('input', (e) => {
        studioState.nameColor = e.target.value;
        updateStudioPreview();
      });
    }

    if (el.studioColorText) {
      el.studioColorText.addEventListener('input', (e) => {
        studioState.textColor = e.target.value;
        updateStudioPreview();
      });
    }

    if (el.studioAnimSelect) {
      el.studioAnimSelect.addEventListener('change', (e) => {
        studioState.anim = e.target.value;
        updateStudioPreview();
      });
    }

    if (el.studioFadeSlider && el.studioFadeVal) {
      el.studioFadeSlider.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        studioState.fade = val;
        el.studioFadeVal.textContent = val === 0 ? 'Mati' : `${val}s`;
        updateStudioPreview();
      });
    }

    if (el.studioToggleAvatar) {
      el.studioToggleAvatar.addEventListener('change', (e) => {
        studioState.hideAvatar = !e.target.checked;
        updateStudioPreview();
      });
    }

    if (el.studioToggleBadges) {
      el.studioToggleBadges.addEventListener('change', (e) => {
        studioState.hideBadges = !e.target.checked;
        updateStudioPreview();
      });
    }

    if (el.btnStudioMockMsg) {
      el.btnStudioMockMsg.addEventListener('click', () => {
        spawnStudioMockMessage();
      });
    }

    if (el.btnCopyCustomOverlay && el.studioGeneratedUrl) {
      el.btnCopyCustomOverlay.addEventListener('click', () => {
        const url = el.studioGeneratedUrl.textContent;
        navigator.clipboard.writeText(url).then(() => {
          showNotification('Tautan Kustom Overlay OBS berhasil disalin!', 'info');
        }).catch(() => {
          showNotification('Gagal menyalin tautan', 'error');
        });
      });
    }
  }

  // HTML sanitization helper
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ==========================================================================
  // Streamer Profiles Manager
  // ==========================================================================
  const PROFILES_KEY = 'strechat_profiles';

  function loadProfiles() {
    try {
      const raw = localStorage.getItem(PROFILES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveProfiles(profiles) {
    try {
      localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
    } catch (e) {
      console.warn('[strechat] Gagal menyimpan profil:', e);
    }
  }

  function renderProfiles() {
    if (!el.profilesList) return;
    const profiles = loadProfiles();
    el.profilesList.innerHTML = '';

    const currentTarget = (el.channelInput?.value || loadSettings().lastUsername || '').trim().replace(/^@+/, '');

    if (profiles.length === 0) {
      el.profilesList.innerHTML = `
        <div style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 11px;">
          Belum ada akun tersimpan. Masukkan username di bawah untuk menyimpan akun streamer Anda.
        </div>
      `;
      return;
    }

    profiles.forEach((username) => {
      const card = document.createElement('div');
      const isCurrent = (username.toLowerCase() === currentTarget.toLowerCase());
      card.className = `profile-card ${isCurrent ? 'active-profile' : ''}`;
      const initial = (username[0] || 'T').toUpperCase();
      card.innerHTML = `
        <div class="profile-card-left" title="Pilih @${escapeHtml(username)} sebagai target siaran OBS">
          <div class="profile-card-avatar">${initial}</div>
          <div style="display:flex; flex-direction:column; min-width:0;">
            <span class="profile-card-name">@${escapeHtml(username)}</span>
            <span style="font-size: 9.5px; color: ${isCurrent ? 'var(--accent-lime)' : 'var(--text-muted)'}; font-weight: ${isCurrent ? '700' : '500'};">
              ${isCurrent ? '● Target Aktif OBS' : 'Klik untuk jadikan target OBS'}
            </span>
          </div>
        </div>
        <button class="profile-card-del" title="Hapus profil" data-user="${escapeHtml(username)}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      `;

      card.querySelector('.profile-card-left').addEventListener('click', () => {
        el.channelInput.value = username;
        saveSettings({ lastUsername: username });
        renderProfiles();
        if (state.obsAutoDetect) {
          startObsAutoDetect();
        }
        showNotification(`Target OBS aktif: @${username}`, 'success');
      });

      card.querySelector('.profile-card-del').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteProfile(username);
      });

      el.profilesList.appendChild(card);
    });
  }

  function addProfile(rawUsername) {
    const username = (rawUsername || '').trim().replace(/^@+/, '');
    if (!username) return;
    const profiles = loadProfiles();
    if (!profiles.includes(username)) {
      profiles.unshift(username);
      if (profiles.length > 20) profiles.pop();
      saveProfiles(profiles);
      renderProfiles();
    }
  }

  function deleteProfile(username) {
    let profiles = loadProfiles();
    profiles = profiles.filter(p => p !== username);
    saveProfiles(profiles);
    renderProfiles();
    showNotification(`Profil @${username} dihapus`, 'info');
  }

  // ==========================================================================
  // In-App Overlay Studio Designer
  // ==========================================================================
  const studioState = {
    theme: 'pixel',
    font: 'Poppins',
    size: 13,
    bg: 'transparent',
    nameColor: '#2b1747',
    textColor: '#432168',
    anim: 'pop',
    fade: 12,
    hideAvatar: false,
    hideBadges: false
  };

  const THEME_DEFAULTS = {
    pixel: { bg: 'transparent', nameColor: '#2b1747', textColor: '#432168', radius: '0px', border: 'none' },
    cyberpunk: { bg: 'transparent', nameColor: '#00f0ff', textColor: '#e2e8f0', radius: '0px', border: 'none' },
    arcade: { bg: 'transparent', nameColor: '#facc15', textColor: '#f1f5f9', radius: '0px', border: 'none' },
    cozy: { bg: 'transparent', nameColor: '#4a1d34', textColor: '#6b284e', radius: '0px', border: 'none' },
    standard: { bg: 'rgba(15, 17, 26, 0.85)', nameColor: '#00f0ff', textColor: '#f1f5f9', radius: '12px', border: '1px solid rgba(255, 255, 255, 0.12)' },
    classic: { bg: 'rgba(15, 17, 26, 0.85)', nameColor: '#00f0ff', textColor: '#f1f5f9', radius: '12px', border: '1px solid rgba(255, 255, 255, 0.12)' }
  };

  function updateStudioPreview() {
    if (!el.studioPreviewFeed) return;
    const themeDef = THEME_DEFAULTS[studioState.theme] || THEME_DEFAULTS.pixel;

    el.studioPreviewFeed.style.setProperty('--studio-bg', studioState.bg);
    el.studioPreviewFeed.style.setProperty('--studio-name', studioState.nameColor);
    el.studioPreviewFeed.style.setProperty('--studio-text', studioState.textColor);
    el.studioPreviewFeed.style.setProperty('--studio-font', `'${studioState.font}', -apple-system, sans-serif`);
    el.studioPreviewFeed.style.setProperty('--studio-size', `${studioState.size}px`);
    el.studioPreviewFeed.style.setProperty('--studio-radius', themeDef.radius);
    el.studioPreviewFeed.style.setProperty('--studio-border', themeDef.border);

    // Toggle avatars & badges in preview feed
    el.studioPreviewFeed.querySelectorAll('.overlay-avatar-placeholder, .pixel-gift-avatar-wrap').forEach(av => {
      av.style.display = studioState.hideAvatar ? 'none' : 'flex';
    });
    el.studioPreviewFeed.querySelectorAll('.overlay-badge, .badge-mod').forEach(badge => {
      badge.style.display = studioState.hideBadges ? 'none' : 'inline-block';
    });

    // Update animations on existing preview items
    el.studioPreviewFeed.querySelectorAll('.overlay-item, .pixel-overlay-banner').forEach(item => {
      item.className = item.className.replace(/\banim-\w+/g, '') + ` anim-${studioState.anim}`;
    });

    updateStudioUrl();
  }

  function updateStudioUrl() {
    if (!el.studioGeneratedUrl) return;
    const origin = window.location.origin;
    const params = new URLSearchParams();

    if (studioState.theme !== 'pixel') params.set('theme', studioState.theme);
    if (studioState.font !== 'Poppins') params.set('font', studioState.font);
    if (Number(studioState.size) !== 13) params.set('size', studioState.size);
    if (studioState.bg !== THEME_DEFAULTS[studioState.theme]?.bg) params.set('bg', studioState.bg);
    if (studioState.nameColor !== THEME_DEFAULTS[studioState.theme]?.nameColor) params.set('nameColor', studioState.nameColor);
    if (studioState.textColor !== THEME_DEFAULTS[studioState.theme]?.textColor) params.set('textColor', studioState.textColor);
    if (studioState.anim !== 'pop') params.set('anim', studioState.anim);
    if (Number(studioState.fade) !== 12) params.set('fade', studioState.fade);
    if (studioState.hideAvatar) params.set('hideAvatar', 'true');
    if (studioState.hideBadges) params.set('hideBadges', 'true');

    const qs = params.toString();
    el.studioGeneratedUrl.textContent = `${origin}/overlay${qs ? '?' + qs : ''}`;
  }

  const MOCK_USERS = [
    { name: 'Rian Pratama', text: 'Overlaynya lucu banget bang! 🔥' },
    { name: 'Siti Rahma', text: 'Semangat terus live-nya kakak cantik! ✨' },
    { name: 'Dimas Gaming', text: 'Bang main game bareng penonton donggg' },
    { name: 'Aldo Wijaya', text: 'Halo semua penonton setia! Absen dari Surabaya' }
  ];

  // Studio SVG Banner Generators (Pure vector, zero external dependencies)
  function buildStudioThemeCommentSvg(theme, name, text, hideBadges) {
    const modBadge = !hideBadges
      ? `<span style="background: rgba(16, 185, 129, 0.25); color: #059669; border: 1px solid rgba(16, 185, 129, 0.5); font-size: 8.5px; font-weight: 700; padding: 1px 5px; border-radius: 4px; text-transform: uppercase;">MOD</span>`
      : '';
    const safeName = escapeHtml(name);
    const safeText = escapeHtml(text);

    switch (theme) {
      case 'cyberpunk':
        return `
          <svg class="pixel-banner-svg" viewBox="0 0 460 120" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="cyber-bg-s" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#050814"/>
                <stop offset="60%" stop-color="#090d1f"/>
                <stop offset="100%" stop-color="#0d142b"/>
              </linearGradient>
              <filter id="cyber-sh-s" x="-10%" y="-15%" width="120%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="5" flood-color="#00f0ff" flood-opacity="0.35"/>
              </filter>
            </defs>
            <g filter="url(#cyber-sh-s)">
              <polygon points="32,24 436,24 446,34 446,96 426,106 22,106 12,96 12,34" fill="url(#cyber-bg-s)" stroke="#00f0ff" stroke-width="2"/>
              <path d="M 12 42 L 12 24 L 42 24" fill="none" stroke="#ff0055" stroke-width="3"/>
              <path d="M 446 88 L 446 106 L 416 106" fill="none" stroke="#ff0055" stroke-width="3"/>
              <polygon points="120,18 270,18 280,24 110,24" fill="#00f0ff" opacity="0.25"/>
              <text x="195" y="23" font-family="monospace" font-size="8.5" font-weight="700" fill="#00f0ff" text-anchor="middle" letter-spacing="1.5">// SYS.LIVE_COMMS // DATA_STREAM</text>
              <circle cx="425" cy="40" r="10" stroke="#00f0ff" stroke-width="1.2" stroke-dasharray="3,2" fill="none"/>
              <circle cx="425" cy="40" r="3" fill="#ff0055"/>
              <polygon points="64,38 86,51 86,77 64,90 42,77 42,51" fill="#02040a" stroke="#00f0ff" stroke-width="2"/>
              <path d="M 68 55 L 68 69 A 5 5 0 1 1 63 64 A 5 5 0 0 1 66 64 L 66 53 L 71 53 A 8 8 0 0 0 74 58 L 74 55 A 6 6 0 0 1 68 55 Z" fill="#ff0055" transform="translate(1, 0.7)"/>
              <path d="M 68 55 L 68 69 A 5 5 0 1 1 63 64 A 5 5 0 0 1 66 64 L 66 53 L 71 53 A 8 8 0 0 0 74 58 L 74 55 A 6 6 0 0 1 68 55 Z" fill="#00f0ff" transform="translate(-1, -0.7)"/>
              <path d="M 68 55 L 68 69 A 5 5 0 1 1 63 64 A 5 5 0 0 1 66 64 L 66 53 L 71 53 A 8 8 0 0 0 74 58 L 74 55 A 6 6 0 0 1 68 55 Z" fill="#ffffff"/>
            </g>
            <foreignObject x="98" y="34" width="318" height="60">
              <div xmlns="http://www.w3.org/1999/xhtml" style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; font-family: 'Poppins', sans-serif; overflow: hidden; box-sizing: border-box; padding-right: 8px;">
                <div style="font-weight: 700; font-size: 13px; color: #00f0ff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.25; display: flex; align-items: center; gap: 6px; text-shadow: 0 0 8px rgba(0, 240, 255, 0.5);">
                  <span>${safeName}</span>
                  ${modBadge}
                </div>
                <div style="font-weight: 500; font-size: 11.5px; color: #e2e8f0; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; word-break: break-word; margin-top: 2px;">
                  ${safeText}
                </div>
              </div>
            </foreignObject>
          </svg>
        `;

      case 'arcade':
        return `
          <svg class="pixel-banner-svg" viewBox="0 0 460 120" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="arc-sh-s" x="-8%" y="-15%" width="120%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.45"/>
              </filter>
            </defs>
            <g filter="url(#arc-sh-s)">
              <rect x="22" y="24" width="416" height="76" rx="6" fill="#180b2b" stroke="#f59e0b" stroke-width="3"/>
              <rect x="26" y="28" width="408" height="68" rx="4" fill="#241242" stroke="#4c1d95" stroke-width="2"/>
              <rect x="135" y="16" width="130" height="16" rx="3" fill="#ef4444" stroke="#000" stroke-width="1.5"/>
              <text x="200" y="28" font-family="monospace" font-size="9" font-weight="900" fill="#fef08a" text-anchor="middle" letter-spacing="1">★ 1UP // ARCADE CHAT ★</text>
              <circle cx="410" cy="42" r="11" fill="#fde047" stroke="#000" stroke-width="2"/>
              <text x="410" y="46" font-family="monospace" font-size="10" font-weight="900" fill="#854d0e" text-anchor="middle">$</text>
              <rect x="46" y="44" width="38" height="42" rx="3" fill="#3b82f6" stroke="#000" stroke-width="2"/>
              <rect x="50" y="48" width="30" height="22" fill="#0f172a"/>
              <path d="M 67 53 L 67 63 A 4 4 0 1 1 63 59 A 4 4 0 0 1 65 59 L 65 51 L 70 51 A 6 6 0 0 0 73 55 L 73 53 A 5 5 0 0 1 67 53 Z" fill="#00f0ff"/>
            </g>
            <foreignObject x="94" y="34" width="320" height="60">
              <div xmlns="http://www.w3.org/1999/xhtml" style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; font-family: 'Poppins', sans-serif; overflow: hidden; box-sizing: border-box; padding-right: 8px;">
                <div style="font-weight: 800; font-size: 13px; color: #facc15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.25; display: flex; align-items: center; gap: 6px; text-shadow: 1px 1px 0 #000;">
                  <span>${safeName}</span>
                  ${modBadge}
                </div>
                <div style="font-weight: 600; font-size: 11.5px; color: #f1f5f9; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; word-break: break-word; margin-top: 2px;">
                  ${safeText}
                </div>
              </div>
            </foreignObject>
          </svg>
        `;

      case 'cozy':
        return `
          <svg class="pixel-banner-svg" viewBox="0 0 460 120" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="cozy-bg-s" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#fffdfa"/>
                <stop offset="60%" stop-color="#fff1f2"/>
                <stop offset="100%" stop-color="#fce7f3"/>
              </linearGradient>
              <filter id="cozy-sh-s" x="-8%" y="-15%" width="120%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#831843" flood-opacity="0.2"/>
              </filter>
            </defs>
            <g filter="url(#cozy-sh-s)">
              <rect x="24" y="28" width="412" height="76" rx="22" fill="url(#cozy-bg-s)" stroke="#4a1d34" stroke-width="3" stroke-linejoin="round"/>
              <rect x="145" y="19" width="120" height="18" rx="9" fill="#fbcfe8" stroke="#4a1d34" stroke-width="2"/>
              <text x="205" y="31.5" font-family="'Poppins', sans-serif" font-size="9" font-weight="700" fill="#831843" text-anchor="middle" letter-spacing="0.3">🌸 Cozy Stream Chat ✨</text>
              <rect x="390" y="12" width="22" height="26" rx="4" fill="#fed7aa" stroke="#4a1d34" stroke-width="2"/>
              <line x1="404" y1="6" x2="398" y2="16" stroke="#f43f5e" stroke-width="3" stroke-linecap="round"/>
              <circle cx="68" cy="66" r="23" fill="#ffe4e6" stroke="#4a1d34" stroke-width="2.5"/>
              <circle cx="68" cy="66" r="19" fill="#4a1d34"/>
              <path d="M 72 56 L 72 70 A 5 5 0 1 1 67 65 A 5 5 0 0 1 70 65 L 70 54 L 75 54 A 8 8 0 0 0 78 59 L 78 56 A 6 6 0 0 1 72 56 Z" fill="#ffffff"/>
            </g>
            <foreignObject x="104" y="38" width="316" height="56">
              <div xmlns="http://www.w3.org/1999/xhtml" style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; font-family: 'Poppins', sans-serif; overflow: hidden; box-sizing: border-box; padding-right: 8px;">
                <div style="font-weight: 700; font-size: 13px; color: #4a1d34; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.25; display: flex; align-items: center; gap: 6px;">
                  <span>${safeName}</span>
                  ${modBadge}
                </div>
                <div style="font-weight: 600; font-size: 11.5px; color: #6b284e; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; word-break: break-word; margin-top: 1px;">
                  ${safeText}
                </div>
              </div>
            </foreignObject>
          </svg>
        `;

      case 'pixel':
      default:
        return `
          <svg class="pixel-banner-svg" viewBox="0 0 460 120" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="comm-bg-s" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#ffffff"/>
                <stop offset="55%" stop-color="#fcf8ff"/>
                <stop offset="100%" stop-color="#f3e8ff"/>
              </linearGradient>
              <linearGradient id="comm-pill-s" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="#3b1d6e"/>
                <stop offset="100%" stop-color="#6b21a8"/>
              </linearGradient>
              <linearGradient id="comm-gold-s" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#fde047"/>
                <stop offset="50%" stop-color="#f59e0b"/>
                <stop offset="100%" stop-color="#d97706"/>
              </linearGradient>
              <filter id="comm-sh-s" x="-8%" y="-15%" width="120%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000000" flood-opacity="0.35"/>
              </filter>
            </defs>
            <g filter="url(#comm-sh-s)">
              <circle cx="36" cy="72" r="14" fill="#c4b5fd" stroke="#251842" stroke-width="3"/>
              <circle cx="48" cy="94" r="16" fill="#a7f3d0" stroke="#251842" stroke-width="3"/>
              <circle cx="82" cy="98" r="13" fill="#fed7aa" stroke="#251842" stroke-width="3"/>
              <circle cx="395" cy="98" r="12" fill="#bfdbfe" stroke="#251842" stroke-width="3"/>
              <circle cx="414" cy="90" r="14" fill="#fbcfe8" stroke="#251842" stroke-width="3"/>
              <rect x="24" y="28" width="412" height="76" rx="18" fill="url(#comm-bg-s)" stroke="#251842" stroke-width="3.5" stroke-linejoin="round"/>
              <rect x="145" y="19" width="112" height="18" rx="9" fill="url(#comm-pill-s)" stroke="#251842" stroke-width="2.5"/>
              <text x="201" y="31.5" font-family="'Poppins', sans-serif" font-size="9" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="0.3">💬 TikTok Chat ♥</text>
              <polygon points="340,28 348,6 360,26" fill="#ffffff" stroke="#251842" stroke-width="3" stroke-linejoin="round"/>
              <polygon points="344,25 349,12 356,24" fill="#f472b6"/>
              <polygon points="385,26 397,6 405,28" fill="#ffffff" stroke="#251842" stroke-width="3" stroke-linejoin="round"/>
              <polygon points="389,24 396,12 401,25" fill="#f472b6"/>
              <ellipse cx="372" cy="22" rx="24" ry="16" fill="#ffffff" stroke="#251842" stroke-width="3"/>
              <path d="M 360 21 Q 364 16 368 21" stroke="#251842" stroke-width="2.5" fill="none" stroke-linecap="round"/>
              <path d="M 376 21 Q 380 16 384 21" stroke="#251842" stroke-width="2.5" fill="none" stroke-linecap="round"/>
              <ellipse cx="358" cy="25" rx="3" ry="2" fill="#f9a8d4"/>
              <ellipse cx="386" cy="25" rx="3" ry="2" fill="#f9a8d4"/>
              <path d="M 370 24 Q 372 26 374 24" stroke="#ec4899" stroke-width="2" fill="none" stroke-linecap="round"/>
              <ellipse cx="352" cy="30" rx="6" ry="4" fill="#ffffff" stroke="#251842" stroke-width="2.5"/>
              <ellipse cx="392" cy="30" rx="6" ry="4" fill="#ffffff" stroke="#251842" stroke-width="2.5"/>
              <rect x="316" y="8" width="20" height="18" rx="6" fill="#ffffff" stroke="#251842" stroke-width="2"/>
              <path d="M 334,16 L 339,18 L 334,20" fill="#ffffff" stroke="#251842" stroke-width="2" stroke-linejoin="round"/>
              <text x="326" y="21" font-family="'Poppins', sans-serif" font-size="11" fill="#ec4899" text-anchor="middle" font-weight="900">♥</text>
              <circle cx="68" cy="66" r="23" fill="#0b0e14" stroke="#251842" stroke-width="3"/>
              <path d="M 72 56 L 72 70 A 5 5 0 1 1 67 65 A 5 5 0 0 1 70 65 L 70 54 L 75 54 A 8 8 0 0 0 78 59 L 78 56 A 6 6 0 0 1 72 56 Z" fill="#ff0055" transform="translate(1.2, 0.8)"/>
              <path d="M 72 56 L 72 70 A 5 5 0 1 1 67 65 A 5 5 0 0 1 70 65 L 70 54 L 75 54 A 8 8 0 0 0 78 59 L 78 56 A 6 6 0 0 1 72 56 Z" fill="#00f0ff" transform="translate(-1.2, -0.8)"/>
              <path d="M 72 56 L 72 70 A 5 5 0 1 1 67 65 A 5 5 0 0 1 70 65 L 70 54 L 75 54 A 8 8 0 0 0 78 59 L 78 56 A 6 6 0 0 1 72 56 Z" fill="#ffffff"/>
              <polygon points="54,49 52,36 60,43 68,33 76,43 84,36 82,49" fill="url(#comm-gold-s)" stroke="#251842" stroke-width="2.5" stroke-linejoin="round"/>
              <circle cx="68" cy="40" r="2.2" fill="#ef4444"/>
              <circle cx="57" cy="42" r="1.8" fill="#38bdf8"/>
              <circle cx="79" cy="42" r="1.8" fill="#38bdf8"/>
              <path d="M 50 30 Q 52 28 50 26 Q 48 28 50 30" fill="#fde047"/>
              <path d="M 85 32 Q 87 30 85 28 Q 83 30 85 32" fill="#fde047"/>
              <path d="M 82,78 C 82,75 79,73 77,75 C 75,73 72,75 72,78 C 72,82 77,85 77,85 C 77,85 82,82 82,78 Z" fill="#f43f5e" stroke="#ffffff" stroke-width="1.5"/>
            </g>
            <foreignObject x="104" y="38" width="316" height="56">
              <div xmlns="http://www.w3.org/1999/xhtml" style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; font-family: 'Poppins', sans-serif; overflow: hidden; box-sizing: border-box; padding-right: 8px;">
                <div style="font-weight: 700; font-size: 13px; color: #2d184c; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.25; display: flex; align-items: center; gap: 6px;">
                  <span>${safeName}</span>
                  ${modBadge}
                </div>
                <div style="font-weight: 600; font-size: 11.5px; color: #432168; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; word-break: break-word; margin-top: 1px;">
                  ${safeText}
                </div>
              </div>
            </foreignObject>
          </svg>
        `;
    }
  }

  function buildStudioThemeGiftSvg(theme, name, hideAvatar) {
    const safeName = escapeHtml(name);
    const initial = escapeHtml((name.charAt(0) || 'G').toUpperCase());

    switch (theme) {
      case 'cyberpunk':
        return `
          <svg class="pixel-banner-svg" viewBox="0 0 460 120" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="cyber-gift-s" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#14061a"/>
                <stop offset="60%" stop-color="#100b26"/>
                <stop offset="100%" stop-color="#050814"/>
              </linearGradient>
              <filter id="cyber-g-sh" x="-10%" y="-15%" width="120%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="5" flood-color="#ff0055" flood-opacity="0.4"/>
              </filter>
            </defs>
            <g filter="url(#cyber-g-sh)">
              <polygon points="32,24 436,24 446,34 446,96 426,106 22,106 12,96 12,34" fill="url(#cyber-gift-s)" stroke="#ff0055" stroke-width="2"/>
              <path d="M 12 42 L 12 24 L 42 24" fill="none" stroke="#00f0ff" stroke-width="3"/>
              <path d="M 446 88 L 446 106 L 416 106" fill="none" stroke="#00f0ff" stroke-width="3"/>
              <polygon points="120,18 270,18 280,24 110,24" fill="#ff0055" opacity="0.3"/>
              <text x="195" y="23" font-family="monospace" font-size="8.5" font-weight="700" fill="#f43f5e" text-anchor="middle" letter-spacing="1.5">// ENERGY_DONATION // REWARD_ALERT</text>
              <polygon points="64,41 87,54 87,78 64,91 41,78 41,54" fill="#050814" stroke="#ff0055" stroke-width="2"/>
              <text x="64" y="71" font-family="monospace" font-size="16" font-weight="900" fill="#00f0ff" text-anchor="middle">${initial}</text>
              <rect x="375" y="44" width="55" height="32" rx="4" fill="#090d1f" stroke="#00f0ff" stroke-width="1.5"/>
              <text x="402" y="58" font-family="monospace" font-size="8" font-weight="700" fill="#00f0ff" text-anchor="middle">OVERLOAD</text>
              <text x="402" y="70" font-family="monospace" font-size="10" font-weight="900" fill="#f43f5e" text-anchor="middle">x2</text>
            </g>
            <foreignObject x="98" y="34" width="270" height="60">
              <div xmlns="http://www.w3.org/1999/xhtml" style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; font-family: 'Poppins', sans-serif; overflow: hidden; box-sizing: border-box;">
                <div style="font-weight: 700; font-size: 13px; color: #ff007a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.25; display: flex; align-items: center; gap: 6px; text-shadow: 0 0 8px rgba(255, 0, 85, 0.5);">
                  <span>${safeName}</span>
                  <span style="background: rgba(255, 0, 85, 0.25); color: #ff0055; border: 1px solid #ff0055; font-size: 8.5px; font-family: monospace; padding: 1px 4px; font-weight: 800;">DONATOR</span>
                </div>
                <div style="font-weight: 500; font-size: 11px; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                  <span>Transfer: <strong>Cyber Battery</strong></span>
                  ⚡
                  <span style="background: rgba(0, 240, 255, 0.2); color: #00f0ff; border: 1px solid #00f0ff; font-family: monospace; font-weight: 700; padding: 1px 5px; border-radius: 2px; font-size: 9.5px;">+50 💎</span>
                </div>
              </div>
            </foreignObject>
          </svg>
        `;

      case 'arcade':
        return `
          <svg class="pixel-banner-svg" viewBox="0 0 460 120" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="arc-g-sh" x="-8%" y="-15%" width="120%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.45"/>
              </filter>
            </defs>
            <g filter="url(#arc-g-sh)">
              <rect x="22" y="24" width="416" height="76" rx="6" fill="#2d061c" stroke="#ec4899" stroke-width="3"/>
              <rect x="26" y="28" width="408" height="68" rx="4" fill="#3b0724" stroke="#831843" stroke-width="2"/>
              <rect x="135" y="16" width="130" height="16" rx="3" fill="#f59e0b" stroke="#000" stroke-width="1.5"/>
              <text x="200" y="28" font-family="monospace" font-size="9" font-weight="900" fill="#000" text-anchor="middle" letter-spacing="1">★ BONUS STAGE WINNER ★</text>
              <circle cx="67" cy="67" r="24" fill="#fde047" stroke="#000" stroke-width="2.5"/>
              <text x="67" y="73" font-family="monospace" font-size="16" font-weight="900" fill="#000" text-anchor="middle">${initial}</text>
              <rect x="380" y="44" width="50" height="34" rx="4" fill="#000" stroke="#f59e0b" stroke-width="1.5"/>
              <text x="405" y="58" font-family="monospace" font-size="8.5" font-weight="800" fill="#a3e635" text-anchor="middle">COMBO</text>
              <text x="405" y="71" font-family="monospace" font-size="11" font-weight="900" fill="#fde047" text-anchor="middle">x2</text>
            </g>
            <foreignObject x="98" y="34" width="275" height="60">
              <div xmlns="http://www.w3.org/1999/xhtml" style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; font-family: 'Poppins', sans-serif; overflow: hidden; box-sizing: border-box;">
                <div style="font-weight: 800; font-size: 13.5px; color: #fde047; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.25; display: flex; align-items: center; gap: 6px; text-shadow: 1px 1px 0 #000;">
                  <span>${safeName}</span>
                </div>
                <div style="font-weight: 600; font-size: 11px; color: #fce7f3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                  <span>Menghadiahkan: <strong>1-UP Coin</strong></span>
                  🪙
                  <span style="background: #fde047; color: #000; font-family: monospace; font-weight: 900; padding: 1px 6px; border-radius: 2px; font-size: 10px;">+20 💎</span>
                </div>
              </div>
            </foreignObject>
          </svg>
        `;

      case 'cozy':
        return `
          <svg class="pixel-banner-svg" viewBox="0 0 460 120" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="cozy-g-s" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#fffaf0"/>
                <stop offset="60%" stop-color="#fdf2f8"/>
                <stop offset="100%" stop-color="#fce7f3"/>
              </linearGradient>
              <filter id="cozy-g-sh" x="-8%" y="-15%" width="120%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#831843" flood-opacity="0.2"/>
              </filter>
            </defs>
            <g filter="url(#cozy-g-sh)">
              <rect x="24" y="28" width="412" height="76" rx="22" fill="url(#cozy-g-s)" stroke="#4a1d34" stroke-width="3" stroke-linejoin="round"/>
              <rect x="145" y="19" width="120" height="18" rx="9" fill="#f472b6" stroke="#4a1d34" stroke-width="2"/>
              <text x="205" y="31.5" font-family="'Poppins', sans-serif" font-size="9" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="0.3">✨ Hadiah Spesial 🌸</text>
              <circle cx="68" cy="66" r="24" fill="#ffffff" stroke="#4a1d34" stroke-width="3"/>
              <text x="68" y="73" font-family="'Poppins', sans-serif" font-size="16" font-weight="800" fill="#831843" text-anchor="middle">${initial}</text>
              <rect x="390" y="48" width="30" height="30" rx="4" fill="#f472b6" stroke="#4a1d34" stroke-width="2"/>
              <line x1="405" y1="48" x2="405" y2="78" stroke="#fbcfe8" stroke-width="3"/>
              <line x1="390" y1="63" x2="420" y2="63" stroke="#fbcfe8" stroke-width="3"/>
            </g>
            <foreignObject x="104" y="38" width="270" height="56">
              <div xmlns="http://www.w3.org/1999/xhtml" style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; font-family: 'Poppins', sans-serif; overflow: hidden; box-sizing: border-box;">
                <div style="font-weight: 700; font-size: 13.5px; color: #4a1d34; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.25; display: flex; align-items: center; gap: 6px;">
                  <span>${safeName}</span>
                  <span style="background: #f43f5e; color: #fff; font-size: 10px; font-weight: 800; padding: 1px 6px; border-radius: 9999px; margin-left: 4px;">x2</span>
                </div>
                <div style="font-weight: 600; font-size: 11px; color: #6b284e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                  <span>Mengirim: <strong>Boba Tea</strong></span>
                  🧋
                  <span style="background: #fce7f3; color: #831843; font-weight: 800; padding: 1px 6px; border-radius: 9999px; border: 1px solid #f472b6; font-size: 10px;">20 💎</span>
                </div>
              </div>
            </foreignObject>
          </svg>
        `;

      case 'pixel':
      default:
        return `
          <svg class="pixel-banner-svg" viewBox="0 0 460 120" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="gift-bg-s" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#ffffff"/>
                <stop offset="50%" stop-color="#fdf4ff"/>
                <stop offset="100%" stop-color="#fae8ff"/>
              </linearGradient>
              <linearGradient id="rainbow-g-s" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="#38bdf8"/>
                <stop offset="35%" stop-color="#facc15"/>
                <stop offset="70%" stop-color="#f472b6"/>
                <stop offset="100%" stop-color="#c084fc"/>
              </linearGradient>
              <linearGradient id="gift-gold-s" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#fde047"/>
                <stop offset="50%" stop-color="#f59e0b"/>
                <stop offset="100%" stop-color="#d97706"/>
              </linearGradient>
              <filter id="gift-sh-s" x="-8%" y="-15%" width="120%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000000" flood-opacity="0.35"/>
              </filter>
            </defs>
            <g filter="url(#gift-sh-s)">
              <path d="M 40 92 Q 180 115 410 98" fill="none" stroke="url(#rainbow-g-s)" stroke-width="7" stroke-linecap="round"/>
              <path d="M 42 95 Q 180 118 408 101" fill="none" stroke="#251842" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
              <polygon points="380,98 382,93 387,95 383,99 385,104 380,101 376,104 378,99 374,95 379,93" fill="#facc15" stroke="#251842" stroke-width="1.5"/>
              <polygon points="42,88 44,84 48,85 45,89 47,93 42,91 38,93 40,89 37,85 41,84" fill="#f472b6" stroke="#251842" stroke-width="1.5"/>
              <rect x="24" y="28" width="412" height="76" rx="18" fill="url(#gift-bg-s)" stroke="#251842" stroke-width="3.5" stroke-linejoin="round"/>
              <circle cx="68" cy="66" r="24" fill="#ffffff" stroke="#251842" stroke-width="3.5"/>
              <text x="68" y="73" font-family="'Poppins', sans-serif" font-size="16" font-weight="800" fill="#9333ea" text-anchor="middle">${initial}</text>
              <g transform="translate(42, 22) rotate(-15 20 20)">
                <polygon points="8,26 6,12 16,19 26,8 36,19 46,12 44,26" fill="url(#gift-gold-s)" stroke="#251842" stroke-width="2.5" stroke-linejoin="round"/>
                <circle cx="26" cy="16" r="2.2" fill="#ef4444"/>
                <circle cx="14" cy="18" r="1.8" fill="#38bdf8"/>
                <circle cx="38" cy="18" r="1.8" fill="#38bdf8"/>
              </g>
              <path d="M 38 28 Q 40 26 38 24 Q 36 26 38 28" fill="#fde047"/>
              <path d="M 88 34 Q 90 32 88 30 Q 86 32 88 34" fill="#fde047"/>
              <polygon points="98,28 100,24 104,25 101,29 103,33 98,31 94,33 96,29 93,25 97,24" fill="#facc15" stroke="#251842" stroke-width="1.5"/>
              <path d="M 44,78 C 44,75 41,73 39,75 C 37,73 34,75 34,78 C 34,82 39,85 39,85 C 39,85 44,82 44,78 Z" fill="#ec4899" stroke="#ffffff" stroke-width="1.5"/>
              <circle cx="400" cy="66" r="22" fill="#0b0e14" stroke="#251842" stroke-width="3"/>
              <path d="M 404 56 L 404 70 A 5 5 0 1 1 399 65 A 5 5 0 0 1 402 65 L 402 54 L 407 54 A 8 8 0 0 0 410 59 L 410 56 A 6 6 0 0 1 404 56 Z" fill="#ff0055" transform="translate(1, 0.7)"/>
              <path d="M 404 56 L 404 70 A 5 5 0 1 1 399 65 A 5 5 0 0 1 402 65 L 402 54 L 407 54 A 8 8 0 0 0 410 59 L 410 56 A 6 6 0 0 1 404 56 Z" fill="#00f0ff" transform="translate(-1, -0.7)"/>
              <path d="M 404 56 L 404 70 A 5 5 0 1 1 399 65 A 5 5 0 0 1 402 65 L 402 54 L 407 54 A 8 8 0 0 0 410 59 L 410 56 A 6 6 0 0 1 404 56 Z" fill="#ffffff"/>
              <path d="M 390 42 Q 394 48 392 54" stroke="#38bdf8" stroke-width="3.5" stroke-linecap="round" fill="none"/>
              <path d="M 406 38 Q 402 46 408 52" stroke="#f472b6" stroke-width="3.5" stroke-linecap="round" fill="none"/>
              <polygon points="418,74 420,70 424,71 421,75 423,79 418,77 414,79 416,75 413,71 417,70" fill="#facc15" stroke="#251842" stroke-width="1.5"/>
            </g>
            <foreignObject x="104" y="38" width="270" height="56">
              <div xmlns="http://www.w3.org/1999/xhtml" style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; font-family: 'Poppins', sans-serif; overflow: hidden; box-sizing: border-box;">
                <div style="font-weight: 700; font-size: 13.5px; color: #2d184c; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.25; display: flex; align-items: center; gap: 6px;">
                  <span>${safeName}</span>
                  <span style="background: linear-gradient(135deg, #00f0ff, #a855f7); color: #fff; font-size: 10px; font-weight: 800; padding: 1px 6px; border-radius: 9999px; margin-left: 4px;">x2</span>
                </div>
                <div style="font-weight: 600; font-size: 11.5px; color: #432168; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 5px; margin-top: 2px;">
                  <span>Mengirim <strong>Panda</strong></span>
                  🎁
                  <span style="background: #fdf2f8; color: #db2777; font-weight: 700; padding: 1px 6px; border-radius: 9999px; border: 1px solid #f472b6; font-size: 10px;">20 💎</span>
                </div>
              </div>
            </foreignObject>
          </svg>
        `;
    }
  }

  let mockToggle = 0;
  function spawnStudioMockMessage() {
    if (!el.studioPreviewFeed) return;
    const randomUser = MOCK_USERS[Math.floor(Math.random() * MOCK_USERS.length)];
    const initial = (randomUser.name[0] || 'U').toUpperCase();
    const item = document.createElement('div');

    if (['pixel', 'cyberpunk', 'arcade', 'cozy'].includes(studioState.theme)) {
      mockToggle = (mockToggle + 1) % 2;
      item.className = `pixel-overlay-banner anim-${studioState.anim}`;
      if (mockToggle === 1) {
        // Theme Gift Banner
        item.innerHTML = buildStudioThemeGiftSvg(studioState.theme, randomUser.name, studioState.hideAvatar);
      } else {
        // Theme Comment Banner
        item.innerHTML = buildStudioThemeCommentSvg(studioState.theme, randomUser.name, randomUser.text, studioState.hideBadges);
      }
    } else {
      // Standard Card Bubble
      item.className = `overlay-item anim-${studioState.anim}`;
      item.innerHTML = `
        <div class="overlay-avatar-placeholder" style="${studioState.hideAvatar ? 'display: none;' : ''}">${initial}</div>
        <div class="overlay-body">
          <div class="overlay-header">
            <span class="overlay-nickname">${escapeHtml(randomUser.name)}</span>
            <span class="overlay-badge badge-mod" style="${studioState.hideBadges ? 'display: none;' : ''}">USER</span>
          </div>
          <div class="overlay-text">${escapeHtml(randomUser.text)}</div>
        </div>
      `;
    }

    el.studioPreviewFeed.appendChild(item);

    // Limit preview items to 4
    const items = el.studioPreviewFeed.children;
    if (items.length > 4) {
      items[0].remove();
    }

    // Auto-fade simulation if fade > 0
    if (Number(studioState.fade) > 0) {
      setTimeout(() => {
        if (item.parentNode) {
          item.style.opacity = '0';
          item.style.transform = 'translateY(-10px)';
          setTimeout(() => item.remove(), 400);
        }
      }, Number(studioState.fade) * 1000);
    }
  }

  // Settings Persistence Helper with safe error handling and defaults
  const SETTINGS_KEY = 'strechat_settings';
  const DEFAULT_SETTINGS = {
    soundEnabled: true,
    ttsEnabled: false,
    chatFontSize: 'normal',
    bannedWords: '',
    sessionId: '',
    autoConnect: false,
    obsAutoDetect: false,
    lastUsername: ''
  };

  let bannedWordsList = [];
  function updateBannedWordsList(raw) {
    if (typeof raw !== 'string' || !raw.trim()) {
      bannedWordsList = [];
      return;
    }
    bannedWordsList = raw.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
  }

  function filterBannedWords(text) {
    if (!text || bannedWordsList.length === 0) return text;
    let filtered = text;
    for (const word of bannedWordsList) {
      if (!word) continue;
      const regex = new RegExp(word.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
      filtered = filtered.replace(regex, '***');
    }
    return filtered;
  }

  function applyChatFontSize(size) {
    const validSizes = ['small', 'normal', 'large'];
    const chosen = validSizes.includes(size) ? size : 'normal';
    document.body.setAttribute('data-chat-size', chosen);
    const btns = document.querySelectorAll('.font-size-btn');
    btns.forEach(b => {
      b.classList.toggle('active', b.dataset.size === chosen);
    });
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw);
      const validSizes = ['small', 'normal', 'large'];
      return {
        soundEnabled: typeof parsed?.soundEnabled === 'boolean' ? parsed.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
        ttsEnabled: typeof parsed?.ttsEnabled === 'boolean' ? parsed.ttsEnabled : DEFAULT_SETTINGS.ttsEnabled,
        chatFontSize: validSizes.includes(parsed?.chatFontSize) ? parsed.chatFontSize : DEFAULT_SETTINGS.chatFontSize,
        bannedWords: typeof parsed?.bannedWords === 'string' ? parsed.bannedWords : DEFAULT_SETTINGS.bannedWords,
        sessionId: typeof parsed?.sessionId === 'string' ? parsed.sessionId : DEFAULT_SETTINGS.sessionId,
        autoConnect: typeof parsed?.autoConnect === 'boolean' ? parsed.autoConnect : DEFAULT_SETTINGS.autoConnect,
        obsAutoDetect: typeof parsed?.obsAutoDetect === 'boolean' ? parsed.obsAutoDetect : DEFAULT_SETTINGS.obsAutoDetect,
        lastUsername: typeof parsed?.lastUsername === 'string' ? parsed.lastUsername : DEFAULT_SETTINGS.lastUsername
      };
    } catch (e) {
      console.warn('[strechat] Gagal membaca pengaturan dari localStorage, menggunakan default:', e);
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(partial) {
    try {
      const current = loadSettings();
      const updated = { ...current, ...partial };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[strechat] Gagal menyimpan pengaturan ke localStorage:', e);
    }
  }

  // Init
  function init() {
    const savedTheme = localStorage.getItem('strechat_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Restore settings
    const settings = loadSettings();
    if (el.settingSound) {
      el.settingSound.checked = settings.soundEnabled;
      if (window.soundEngine) window.soundEngine.enabled = settings.soundEnabled;
    }
    if (el.settingTts) {
      el.settingTts.checked = settings.ttsEnabled;
      if (window.ttsEngine) window.ttsEngine.enabled = settings.ttsEnabled;
    }

    // Restore Font Size & Blacklist
    applyChatFontSize(settings.chatFontSize);
    const settingBlacklist = document.getElementById('setting-blacklist');
    if (settingBlacklist) {
      settingBlacklist.value = settings.bannedWords;
      updateBannedWordsList(settings.bannedWords);
    }

    // Restore Session ID, Auto-Connect, and Last Username
    if (el.settingSessionId && settings.sessionId) {
      el.settingSessionId.value = settings.sessionId;
    }
    if (el.settingAutoConnect) {
      el.settingAutoConnect.checked = !!settings.autoConnect;
    }
    if (settings.lastUsername && el.channelInput) {
      el.channelInput.value = settings.lastUsername;
    }

    // Restore OBS Auto-Detect setting (defaults to false for flexible manual monitoring)
    state.obsAutoDetect = !!settings.obsAutoDetect;
    if (el.settingObsAutoDetect) {
      el.settingObsAutoDetect.checked = state.obsAutoDetect;
    }
    updateAutoDetectStatusUI(state.obsAutoDetect, state.obsAutoDetect ? `Standby: Menunggu siaran @${el.channelInput?.value || settings.lastUsername || 'streamer'} di OBS` : 'Mode Normal (Koneksi Manual). Auto-detect OBS nonaktif.');

    setupEventListeners();
    initWebSocket();
    loadServerInfo();
    renderProfiles();
    updateStudioUrl();
    loadAnalyticsData();

    if (state.obsAutoDetect) {
      startObsAutoDetect();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
