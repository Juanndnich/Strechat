# strechat 🚀

> **Lightweight, Zero-Delay TikTok Live Monitor & OBS Streaming Companion.**  
> Monitor your TikTok Live stream outside OBS with real-time viewer counts, animated gifts, like velocity, top donor leaderboards, session analytics, transparent OBS overlays, and audio/TTS alerts.

[![Release](https://img.shields.io/badge/release-v1.0.0-indigo.svg)](https://github.com/Juanndnich/Strechat/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20OBS-blue.svg)](#)

---

## 🌟 Key Capabilities

- **⚡ Direct TikTok Webcast Ingestion**: Direct connection to official TikTok Webcast WebSocket endpoints (`piratetok-live-js`). 100% free with no third-party signing fees or EulerStream subscriptions.
- **👁️ Live Viewers & Peak Tracker**: Real-time audience monitoring, peak viewer recording, and continuous 6-second polling sync.
- **💖 Interactive Likes Velocity**: Live tap counter with heartbeat pulse animations.
- **🎁 Smart Floating Gift Banners**:
  - Compact floating banner pool (max 2 banners) that never obstructs your chat feed.
  - Multiplier combo detection (`x5`, `x10`, `x50`).
  - Total diamond/coin calculation.
  - Procedural sound chime alerts generated in real-time via Web Audio API (0 KB audio assets needed).
- **📊 Live Analytics & Top Gifters Leaderboard**:
  - Live session summary: Stream duration, peak viewers, average viewers, total diamonds, and total likes.
  - **Top 5 Donors Leaderboard** ranked in real-time.
  - **1-Click Data Export**: Download complete session reports in **CSV** or **JSON** format.
- **💬 Real-Time Live Chat Stream**:
  - Clean Poppins typography with adjustable text sizes (**Small**, **Normal**, **Large**).
  - One-click **Clear Chat Feed** button to refresh the screen without resetting session statistics.
  - One-click **Pin Message** bar.
  - Built-in **Bad Words Moderation Filter** with automatic `***` masking.
  - Filter pills (*All*, *Gifts Only*) and instant search.
- **🎨 In-App Overlay Studio / OBS Custom Designer**:
  - **5 Built-in Design Presets**: *Classic Box*, *Modern Pill*, *Glassmorphism*, *Neon Glow*, and *Borderless*.
  - **Typography & Font Customization**: Safe Google Fonts loader (Poppins, Montserrat, Roboto, Inter, Bangers, Ubuntu) and text scale slider.
  - **Full Color Customization**: Customize bubble background, username color, and message text color.
  - **4 Entrance Animations**: *Pop In*, *Slide In*, *Fade In*, *Bounce*.
  - **Configurable Auto-Fade Timer**: Set chat bubbles to smoothly vanish after a specified duration (e.g. 5s, 10s, 15s) or stay permanently.
  - **Live Preview Simulator**: Real-time preview canvas with mock chat injector for instant testing.
  - **Independent Custom URLs**: URL automatically encodes your query parameters (e.g., `/overlay?theme=neon&anim=slide`).
- **👥 Multi-Profile Streamer Manager**:
  - Save and organize multiple TikTok accounts.
  - Switch between saved streamer accounts with 1 click without re-typing usernames.
- **🔐 Secure TikTok Session & Auto-Connect**:
  - Optional client-side `sessionid` support to access age-restricted (18+) or follower-only live streams safely without data leaks.
  - Optional auto-connect on app launch.
- **🎬 OBS Studio Integration**:
  - **Transparent Chat Overlay (`http://localhost:3000/overlay`)**: High-contrast, transparent background, auto-fading overlay for OBS Browser Source.
  - **OBS Custom Browser Dock (`http://localhost:3000`)**: Embed the complete interactive monitor dock directly into your OBS Studio window.
- **📥 System Tray & Background Ingestion**:
  - Minimize or hide to System Tray on close.
  - Background audio, TTS, and WebSocket streams run at 100% full speed with `backgroundThrottling: false`.
- **🗣️ Text-To-Speech (TTS)**: Built-in voice synthesizer announcing donor names and gifts.
- **📱 Multi-Device LAN Monitoring**: Automatically detects local host IP for monitoring from mobile phones or tablets on the same Wi-Fi.
- **🛡️ Hardened Security**: Electron Context Isolation, strict Renderer Sandbox (`sandbox: true`), external navigation guard (`shell.openExternal`), and robust XSS sanitization.
- **🎮 Built-In Demo Mode**: Simulate realistic live traffic, gifts, and chats with 1 click to test your layout anytime.

---

## 📦 Installation & Quick Start

### Prerequisites
- Node.js v18.0.0 or higher
- npm

### 1. Clone & Install
```bash
git clone https://github.com/Juanndnich/Strechat.git
cd Strechat
npm install
```

### 2. Run Automated Unit Tests
```bash
npm test
```

### 3. Run Desktop Application
```bash
npm start
```

### 4. Run Web / Headless Server (For Browser or LAN Access)
```bash
npm run server
```
Then open `http://localhost:3000` in any browser or on your mobile device via the LAN IP displayed in the terminal.

---

## 🎥 OBS Studio Integration Guide

### A. Transparent Chat Overlay (Browser Source)
1. In OBS Studio, go to your **Sources** panel and click **+** -> **Browser**.
2. Name it `Strechat Overlay`.
3. Set **URL** to: `http://localhost:3000/overlay`
4. Set **Width**: `480`, **Height**: `720` (or adjust to fit your scene).
5. Check **Shutdown source when not visible** (optional).
6. Click **OK**. Transparent chat bubbles with high-contrast text outlines will float cleanly over your gameplay.

### B. Custom Browser Dock (Panel inside OBS)
1. In OBS Studio, open the top menu: **Docks** -> **Custom Browser Docks...**
2. In **Dock Name**, enter: `Strechat Monitor`
3. In **URL**, enter: `http://localhost:3000`
4. Click **Apply**. Dock the panel anywhere in your OBS workspace.

---

## 🛠️ Building Standalone Installers

Package `strechat` into native desktop installers and portable executables:

```bash
# Build for Windows (.exe NSIS installer & portable)
npm run dist:win

# Build for macOS (.dmg & .zip)
npm run dist:mac

# Build for Linux (.AppImage & .deb)
npm run dist:linux
```

Output files are generated in the `dist/` directory.

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more details.
