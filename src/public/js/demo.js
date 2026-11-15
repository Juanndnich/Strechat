/**
 * strechat - Demo & Simulation Engine
 * Allows testing all UI components, animations, sounds, and stats without an active live stream.
 */

class DemoEngine {
  constructor() {
    this.isActive = false;
    this.timers = [];
    this.mockUsers = [
      { name: 'budi_santoso', nick: 'Budi Gaming', mod: false, sub: true },
      { name: 'siti_zahra', nick: 'Zahra Stream', mod: true, sub: true },
      { name: 'dimas_pratama', nick: 'Dimas Pro', mod: false, sub: false },
      { name: 'anisa_bella', nick: 'Bella Cute', mod: false, sub: false },
      { name: 'rizky_stream', nick: 'Rizky', mod: false, sub: true },
      { name: 'teuku_umar', nick: 'Teuku U', mod: false, sub: false },
      { name: 'citra_ayu', nick: 'Citra Ayu', mod: false, sub: false }
    ];

    this.mockComments = [
      'Halo bang, semangat live streamingnya!',
      'Kapan main game bareng penonton?',
      'Keren banget setup komputernya!',
      'Lagi di daerah mana bang sekarang?',
      'Follow balik dong bang please',
      'Wah lancar banget tanpa delay aplikasinya!',
      'Bagi tips dong buat pemula',
      'Gaspol terus bang!',
      'Yuk tap tap layar tembusin 10k like!'
    ];

    this.mockGifts = [
      { name: 'Rose', diamonds: 1, img: 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.png' },
      { name: 'TikTok', diamonds: 1, img: 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/4e297893ca7fa988f57fa2cdfc643190~tplv-obj.png' },
      { name: 'Finger Heart', diamonds: 5, img: 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/c3b9b46944066c0ef49704e6c35c6e8e~tplv-obj.png' },
      { name: 'Panda', diamonds: 5, img: 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/0a49bc44bc60e2b5dc4334f59fcb0c40~tplv-obj.png' },
      { name: 'Doughnut', diamonds: 30, img: 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/a0ca25867ffc2cb3ea0cb83a8b417c8a~tplv-obj.png' }
    ];
  }

  start(onEvent) {
    if (this.isActive) return;
    this.isActive = true;

    // Initial state
    onEvent('status', {
      status: 'CONNECTED',
      uniqueId: 'demo_streamer',
      stats: {
        viewerCount: 840,
        peakViewers: 1250,
        totalLikes: 4520,
        totalDiamonds: 210,
        totalGifts: 45,
        totalComments: 180,
        connectedAt: Date.now() - 120000
      }
    });

    // Chat interval
    const chatTimer = setInterval(() => {
      if (!this.isActive) return;
      const user = this.mockUsers[Math.floor(Math.random() * this.mockUsers.length)];
      const text = this.mockComments[Math.floor(Math.random() * this.mockComments.length)];

      onEvent('chat', {
        id: `demo-${Date.now()}`,
        uniqueId: user.name,
        nickname: user.nick,
        comment: text,
        profilePictureUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${user.name}`,
        badges: user.mod ? [{ type: 'mod', name: 'MOD' }] : [],
        isModerator: user.mod,
        isSubscriber: user.sub,
        timestamp: Date.now()
      });
    }, 1800);
    this.timers.push(chatTimer);

    // Likes interval
    const likeTimer = setInterval(() => {
      if (!this.isActive) return;
      const user = this.mockUsers[Math.floor(Math.random() * this.mockUsers.length)];
      const count = Math.floor(Math.random() * 15) + 3;

      onEvent('like', {
        uniqueId: user.name,
        nickname: user.nick,
        likeCount: count,
        timestamp: Date.now()
      });
    }, 900);
    this.timers.push(likeTimer);

    // Gifts interval
    const giftTimer = setInterval(() => {
      if (!this.isActive) return;
      const user = this.mockUsers[Math.floor(Math.random() * this.mockUsers.length)];
      const gift = this.mockGifts[Math.floor(Math.random() * this.mockGifts.length)];
      const repeat = Math.floor(Math.random() * 5) + 1;

      onEvent('gift', {
        id: `demo-gift-${Date.now()}`,
        uniqueId: user.name,
        nickname: user.nick,
        profilePictureUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${user.name}`,
        gift: {
          giftId: 1001,
          giftName: gift.name,
          diamondCount: gift.diamonds,
          repeatCount: repeat,
          repeatEnd: true,
          giftPictureUrl: gift.img
        },
        repeatCount: repeat,
        repeatEnd: true,
        diamonds: gift.diamonds,
        timestamp: Date.now()
      });
    }, 5000);
    this.timers.push(giftTimer);

    // Viewers fluctuation
    const viewerTimer = setInterval(() => {
      if (!this.isActive) return;
      const delta = Math.floor(Math.random() * 21) - 10;
      onEvent('viewers', {
        viewerDelta: delta,
        timestamp: Date.now()
      });
    }, 3000);
    this.timers.push(viewerTimer);
  }

  stop() {
    this.isActive = false;
    this.timers.forEach((t) => clearInterval(t));
    this.timers = [];
  }
}

window.demoEngine = new DemoEngine();
