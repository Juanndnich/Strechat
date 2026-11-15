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
    filter: 'all', // all | gifts | questions | mods
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
    settingTts: document.getElementById('setting-tts'),
    settingTtsGifts: document.getElementById('setting-tts-gifts')
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
        // Measure ping
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
        renderChatMessage(data);
        break;

      case 'gift':
        handleGiftEvent(data);
        break;

      case 'like':
        handleLikeEvent(data);
        break;

      case 'viewers':
        state.stats.viewerCount = data.viewerCount;
        state.stats.peakViewers = data.peakViewers;
        el.metricViewers.textContent = formatNumber(data.viewerCount);
        el.metricPeak.textContent = `Puncak: ${formatNumber(data.peakViewers)}`;
        break;

      case 'stats_update':
        if (data && data.stats) {
          syncStats(data.stats);
        }
        break;

      case 'error':
        showNotification(data?.message || 'Terjadi kesalahan pada live stream', 'error');
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

    item.innerHTML = `
      ${avatarHtml}
      <div class="chat-body">
        <div class="chat-header">
          <span class="chat-nickname" title="@${chat.uniqueId}">${chat.nickname}</span>
          ${badgesHtml}
          <span class="chat-time">${timeString}</span>
        </div>
        <div class="chat-text">${chat.comment}</div>
      </div>
      <div class="chat-actions">
        <button class="chat-action-btn btn-pin-item" title="Sematkan Pesan">📌 Pin</button>
      </div>
    `;

    // Pin click handler
    const btnPinItem = item.querySelector('.btn-pin-item');
    if (btnPinItem) {
      btnPinItem.addEventListener('click', (e) => {
        e.stopPropagation();
        pinMessage(chat.nickname, chat.comment);
      });
    }

    // Apply Filter Visibility
    applyItemFilter(item);

    el.chatContainer.appendChild(item);

    // Bounded buffer: remove oldest items if exceeding 300
    if (el.chatContainer.children.length > 300) {
      el.chatContainer.removeChild(el.chatContainer.firstElementChild);
    }

    // Smooth auto scroll
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
      void heartIcon.offsetWidth; // trigger reflow
      heartIcon.classList.add('heart-pulse');
    }
  }

  // Gift Event & Floating Banner
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

    // Gift Banner Popup
    const banner = document.createElement('div');
    banner.className = 'gift-banner';

    let avatarSrc = data.profilePictureUrl && data.profilePictureUrl.startsWith('http')
      ? `<img class="gift-avatar" src="${data.profilePictureUrl}" alt="${data.nickname}">`
      : `<div class="gift-avatar-placeholder">${data.nickname.charAt(0).toUpperCase()}</div>`;

    let giftImg = gift.giftPictureUrl
      ? `<img class="gift-icon-img" src="${gift.giftPictureUrl}" alt="${gift.giftName}">`
      : `🎁`;

    const comboHtml = data.repeatCount > 1
      ? `<span class="gift-combo-badge">x${data.repeatCount}</span>`
      : '';

    banner.innerHTML = `
      <div class="gift-banner-left">
        ${avatarSrc}
        <div class="gift-info">
          <span class="gift-sender">${data.nickname}</span>
          <span class="gift-desc">Mengirim <strong>${gift.giftName}</strong> (${diamonds} 💎)</span>
        </div>
      </div>
      <div class="gift-banner-right">
        ${giftImg}
        ${comboHtml}
      </div>
    `;

    el.giftBannerArea.appendChild(banner);

    // Auto remove banner after 4.5 seconds
    setTimeout(() => {
      banner.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      banner.style.opacity = '0';
      banner.style.transform = 'translateY(-10px)';
      setTimeout(() => banner.remove(), 400);
    }, 4500);
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
    const isQuestion = item.dataset.isQuestion === 'true';
    const isMod = item.dataset.isMod === 'true';
    const text = item.textContent.toLowerCase();

    let matchesFilter = true;
    if (state.filter === 'questions' && !isQuestion) matchesFilter = false;
    if (state.filter === 'mods' && !isMod) matchesFilter = false;

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
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'error' ? '#e11d48' : '#4f46e5'};
      color: #fff;
      padding: 8px 16px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 500;
      box-shadow: 0 4px 14px rgba(0,0,0,0.4);
      z-index: 999;
      animation: slideInUp 0.3s ease;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Fetch Server & Network Info
  async function loadServerInfo() {
    try {
      const res = await fetch('/api/info');
      if (res.ok) {
        const info = await res.json();
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
        showNotification('Demo mode dimatikan.', 'info');
      } else {
        state.isDemo = true;
        el.btnDemo.classList.add('active');
        setUIConnectedState(true);
        state.uniqueId = 'demo_user';
        showNotification('Demo mode aktif (simulasi stream).', 'info');
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
        showNotification('Tautan remote disalin ke clipboard!', 'info');
      });
    });

    // Sound and TTS toggles
    el.settingSound.addEventListener('change', (e) => {
      if (window.soundEngine) {
        window.soundEngine.enabled = e.target.checked;
      }
    });

    el.settingTts.addEventListener('change', (e) => {
      if (window.ttsEngine) {
        window.ttsEngine.enabled = e.target.checked;
      }
    });

    // Electron desktop integration
    if (window.electronAPI && window.electronAPI.isElectron) {
      if (el.btnMin) el.btnMin.addEventListener('click', () => window.electronAPI.minimize());
      if (el.btnMax) el.btnMax.addEventListener('click', () => window.electronAPI.maximize());
      if (el.btnClose) el.btnClose.addEventListener('click', () => window.electronAPI.close());
      if (el.btnPin) {
        el.btnPin.addEventListener('click', () => {
          state.isAlwaysOnTop = !state.isAlwaysOnTop;
          window.electronAPI.setAlwaysOnTop(state.isAlwaysOnTop);
          el.btnPin.classList.toggle('pinned', state.isAlwaysOnTop);
        });
      }
    } else {
      // In browser / LAN mode, hide window controls
      if (el.titlebar) {
        const controls = el.titlebar.querySelector('.titlebar-controls');
        if (controls) controls.style.display = 'none';
      }
    }
  }

  // Init
  function init() {
    const savedTheme = localStorage.getItem('strechat_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    setupEventListeners();
    initWebSocket();
    loadServerInfo();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
