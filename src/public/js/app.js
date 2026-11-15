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
    isAlwaysOnTop: false
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
    settingTts: document.getElementById('setting-tts')
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
  }

  function setUIConnectedState(isConnected) {
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
    } else {
      el.statusDot.className = 'status-dot disconnected';
      el.statusText.textContent = 'Terputus';
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

    const heartIcon = document.querySelector('.metric-card.likes svg');
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
    }

    // Floating Banner Pooling: Update existing combo or show max 2 compact banners
    const giftKey = `${data.uniqueId || data.nickname}_${gift.giftName}`;
    const existing = el.giftBannerArea.querySelector(`[data-gift-key="${giftKey}"]`);

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
        desc.innerHTML = `Mengirim <strong>${gift.giftName}</strong> (${diamonds} Diamond)`;
      }
      clearTimeout(existing._timer);
      existing._timer = setTimeout(() => {
        existing.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
        existing.style.opacity = '0';
        existing.style.transform = 'translateY(-6px)';
        setTimeout(() => existing.remove(), 250);
      }, 2500);
    } else {
      // Keep at most 2 banners in view to never cover chat
      while (el.giftBannerArea.children.length >= 2) {
        el.giftBannerArea.removeChild(el.giftBannerArea.firstElementChild);
      }

      const banner = document.createElement('div');
      banner.className = 'gift-banner';
      banner.dataset.giftKey = giftKey;

      let avatarSrc = data.profilePictureUrl && data.profilePictureUrl.startsWith('http')
        ? `<img class="gift-avatar" src="${data.profilePictureUrl}" alt="${data.nickname}">`
        : `<div class="gift-avatar-placeholder">${data.nickname.charAt(0).toUpperCase()}</div>`;

      let giftImg = gift.giftPictureUrl
        ? `<img class="gift-icon-img" src="${gift.giftPictureUrl}" alt="${gift.giftName}">`
        : `<svg class="gift-icon-img" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line></svg>`;

      const comboHtml = data.repeatCount > 1
        ? `<span class="gift-combo-badge">x${data.repeatCount}</span>`
        : '';

      banner.innerHTML = `
        <div class="gift-banner-left">
          ${avatarSrc}
          <div class="gift-info">
            <span class="gift-sender">${data.nickname}</span>
            <span class="gift-desc">Mengirim <strong>${gift.giftName}</strong> (${diamonds} Diamond)</span>
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
      }, 2500);
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

    let avatarHtml = '';
    if (data.profilePictureUrl && data.profilePictureUrl.startsWith('http')) {
      avatarHtml = `<img class="chat-avatar" src="${data.profilePictureUrl}" alt="${data.nickname}">`;
    } else {
      avatarHtml = `<div class="chat-avatar-placeholder">${data.nickname.charAt(0).toUpperCase()}</div>`;
    }

    let giftImg = data.gift.giftPictureUrl
      ? `<img src="${data.gift.giftPictureUrl}" style="width: 20px; height: 20px; vertical-align: middle; margin-left: 4px;" alt="">`
      : '';

    const timeString = new Date(data.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    item.innerHTML = `
      ${avatarHtml}
      <div class="chat-body">
        <div class="chat-header">
          <span class="chat-nickname">${data.nickname}</span>
          <span class="badge-item badge-gift">GIFT</span>
          <span class="chat-time">${timeString}</span>
        </div>
        <div class="chat-text gift-highlight">
          Mengirim <strong>${data.gift.giftName}</strong> (${diamonds} Diamond) ${data.repeatCount > 1 ? 'x' + data.repeatCount : ''} ${giftImg}
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

  // Event Listeners
  function setupEventListeners() {
    // Connect / Disconnect Button
    el.btnConnect.addEventListener('click', () => {
      if (state.connected) {
        if (state.isDemo) {
          window.demoEngine.stop();
          state.isDemo = false;
          el.btnDemo.classList.remove('active');
          setUIConnectedState(false);
          return;
        }
        sendWsAction('disconnect');
      } else {
        const username = el.channelInput.value.trim().replace(/^@+/, '');
        if (!username) {
          showNotification('Masukkan username TikTok terlebih dahulu', 'error');
          el.channelInput.focus();
          return;
        }
        sendWsAction('connect', { username });
        el.statusDot.className = 'status-dot connecting';
        el.statusText.textContent = 'Menghubungkan...';
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
  }

  // Settings Persistence Helper with safe error handling and defaults
  const SETTINGS_KEY = 'strechat_settings';
  const DEFAULT_SETTINGS = {
    soundEnabled: true,
    ttsEnabled: false,
    chatFontSize: 'normal',
    bannedWords: ''
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
        bannedWords: typeof parsed?.bannedWords === 'string' ? parsed.bannedWords : DEFAULT_SETTINGS.bannedWords
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

    setupEventListeners();
    initWebSocket();
    loadServerInfo();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
