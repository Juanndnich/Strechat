# strechat 🚀

> **Lightweight, Zero-Delay TikTok Live Monitor & Chat Companion for Desktop and Multi-Device Streams.**  
> Monitor your TikTok Live stream outside OBS with real-time viewer counts, animated incoming gifts & GIFs, like velocity, pinned comments, and audio/TTS alerts.

[![Release](https://img.shields.io/badge/release-v1.0.0-indigo.svg)](https://github.com/strechat/strechat/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Web-blue.svg)](#)

---

## 🌟 Key Features

- **⚡ Zero-Delay Real-Time WebSocket Engine**: Instant delivery of comments, likes, and gifts with no buffering lag.
- **👁️ Live Viewers & Peak Tracker**: Monitor real-time audience size and track the highest peak viewers in your session.
- **💖 Interactive Likes Counter & Heartbeat Animation**: Visual feedback with heart animations as viewers tap on your live stream.
- **🎁 Animated Incoming Gifts & GIFs**:
  - Live gift notification banners with combo multipliers (`x5`, `x10`, `x50`).
  - Total diamonds/coins calculation.
  - Procedural sound chime alerts generated in real-time via Web Audio API (0 KB audio assets needed).
- **💬 Real-Time Live Chat Stream**:
  - Clean Poppins typography designed for high stream visibility.
  - User avatars and role badges (**MOD**, **SUB**).
  - One-click **Pin Message** to keep critical comments pinned at the top.
  - Instant filters: *All*, *Questions Only (?)*, *Moderator Only*, and Live keyword search.
- **🗣️ Text-To-Speech (TTS)**: Built-in voice announcements for incoming gifts and stream milestones.
- **📱 Multi-Device LAN Second-Screen Mode**:
  - Run as a standalone desktop app or open on your smartphone, tablet, or second computer via local Wi-Fi.
- **🛡️ Complex Yet Secure Architecture**:
  - Strict HTML sanitization and XSS prevention.
  - Electron Context Isolation & Content Security Policy (CSP).
  - Auto-reconnect with exponential backoff on network hiccups.
- **🎮 Built-In Demo Mode**: Simulate realistic live traffic, gifts, and chats with 1 click to test your layout anytime.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│                   TikTok Live Stream                   │
└───────────────────────────┬────────────────────────────┘
                            │ Webcast Protobuf Stream
┌───────────────────────────▼────────────────────────────┐
│              strechat Core Backend (Node.js)           │
│  - tiktok-live-connector v2                            │
│  - Event Normalizer & Input Sanitizer (XSS protection) │
│  - Resilience & Exponential Backoff Reconnector        │
└─────────────┬───────────────────────────┬──────────────┘
              │ Local WebSocket (/ws)     │ HTTP REST API
┌─────────────▼───────────────────────────▼──────────────┐
│                  Presentation Layer                    │
│  ┌─────────────────────────┐  ┌──────────────────────┐ │
│  │ Electron Native Window  │  │ Mobile/LAN Web View  │ │
│  │ (Frameless, AlwaysOnTop)│  │ (Phone, Tablet, OBS) │ │
│  └─────────────────────────┘  └──────────────────────┘ │
│  - Minimalist Poppins UI        - Synthesized Audio   │
│  - 60 FPS Spring Animations     - Web Speech TTS      │
└────────────────────────────────────────────────────────┘
```

---

## 📦 Installation & Quick Start

### Prerequisites
- Node.js v18.0.0 or higher
- npm or pnpm

### 1. Clone & Install
```bash
git clone https://github.com/your-username/strechat.git
cd strechat
npm install
```

### 2. Run Desktop Application
```bash
npm start
```

### 3. Run Web / Headless Server (For browser or LAN access)
```bash
npm run server
```
Then open `http://localhost:3000` in any browser or on your phone using your computer's local IP address displayed in the console.

---

## 🛠️ Building Standalone Binaries for GitHub Releases

You can package `strechat` into native desktop installers and portable executables:

```bash
# Build for Windows (.exe installer & portable)
npm run dist:win

# Build for macOS (.dmg & .zip)
npm run dist:mac

# Build for Linux (.AppImage & .deb)
npm run dist:linux
```

Output files will be generated in the `dist/` directory ready for deployment.

---

## 🚀 Publishing to GitHub Releases

1. **Commit and push your changes**:
   ```bash
   git add .
   git commit -m "feat: initial release v1.0.0"
   git remote add origin https://github.com/your-username/strechat.git
   git push -u origin main
   ```

2. **Create and push a release tag**:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

3. The automated **GitHub Actions Workflow** (`.github/workflows/build-release.yml`) will automatically compile the Windows, Mac, and Linux executables and create a published release under your repository's Releases tab.

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more details.
