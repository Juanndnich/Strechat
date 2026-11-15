# Changelog

Semua perubahan penting pada proyek Strechat didokumentasikan di berkas ini.

## [1.0.0] - 2026-11-15

### Keamanan (Security - P1)
- **Navigation Guard:** Menambahkan `setWindowOpenHandler` dan `will-navigate` pada Electron Main Process untuk memastikan seluruh tautan eksternal dibuka melalui browser default OS (`shell.openExternal`) dan memblokir navigasi tidak sah di dalam frame aplikasi.
- **Strict Sandbox:** Mengaktifkan `sandbox: true` pada BrowserWindow webPreferences dengan Context Isolation dan Preload IPC yang terisolasi.
- **Graceful Server Shutdown:** Menambahkan fungsi `stopServer()` terstruktur di `src/server/app.js` dan pembersihan listener WebSocket di `src/server/websocketHandler.js` untuk memastikan penutupan bersih dan pelepasan port saat aplikasi keluar.

### Keandalan (Reliability - P2)
- **Settings Persistence:** Mengimplementasikan penyimpanan pengaturan (Gift Sound dan Text-to-Speech) ke `localStorage` dengan penanganan data aman (`try/catch`) dan fallback nilai bawaan.
- **Windows Multi-Size Icon:** Menyediakan berkas `src/public/icons/icon.ico` yang mengintegrasikan resolusi 16x16, 24x24, 32x32, 48x48, 64x64, 128x128, dan 256x256 untuk mendukung taskbar dan installer Windows secara native.
- **Automated Unit Testing:** Menambahkan rangkaian pengujian unit dengan 24 skenario pengujian (`npm test`) mencakup sanitasi karakter XSS, penanganan username, perhitungan gift diamond, dan normalisasi event TikTok.

### Fitur & Antarmuka Sebelumnya
- **TikTok Direct Webcast Connector:** Integrasi langsung dengan TikTok Webcast WebSocket resmi (`piratetok-live-js`) tanpa biaya pihak ketiga.
- **OBS Studio Overlays:** Tampilan transparan chat overlay (`/overlay`) untuk OBS Browser Source dan Custom Browser Docks (`/`).
- **Minimalist Obsidian Dark Theme:** Desain antarmuka minimalis dengan tipografi Poppins dan 100% SVG Vector Icons.
- **Keepalive & Sync:** Penjaga status terhubung dan polling metrik penonton/suka setiap 6 detik.
- **Smart Gift Combo:** Penampung banner gift melayang maksimal 2 kartu agar tidak menutupi feed obrolan.
