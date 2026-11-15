# Strechat - Implementation Roadmap

Dokumen ini memetakan tahapan implementasi teknis Strechat dari tahap stabilitas kritis hingga fitur lanjutan.

---

## 📌 Phase 1 — Critical Stability (P1) — SELESAI ✅
- [x] **Electron Navigation Security:** Pembatasan jendela dengan `setWindowOpenHandler` dan pencegahan navigasi liar via `will-navigate`.
- [x] **Electron Strict Sandbox:** Mengaktifkan `sandbox: true` pada BrowserWindow webPreferences.
- [x] **Graceful Server Shutdown:** Menghentikan TikTok client, menutup koneksi WebSocket, dan mematikan HTTP server secara bersih untuk melepaskan port.
- [x] **Direct TikTok Webcast Ingestion:** Koneksi tanpa biaya pihak ketiga (bebas EulerStream).
- [x] **Keepalive Heartbeat & Polling Sync:** Penjaga status aktif dan sinkronisasi berkala 6 detik.

---

## 📌 Phase 2 — Reliability & Quality (P2) — SELESAI ✅
- [x] **Settings Persistence:** Penyimpanan preferensi pengguna (Gift Sound & TTS) menggunakan `localStorage` dengan penanganan data korup.
- [x] **Windows Multi-Size Icon:** Pembuatan asset `src/public/icons/icon.ico` (resolusi 16x16 hingga 256x256) dan konfigurasi electron-builder.
- [x] **Automated Unit Testing:** Rangkaian 24 unit test otomatis untuk sanitasi string, kalkulasi diamond gift, dan normalisasi event (`npm test`).
- [x] **Bilingual Documentation:** Dokumentasi pengguna dan panduan OBS dalam Bahasa Indonesia dan Bahasa Inggris.

---

## 📌 Phase 3 — Streamer Experience & Usability (P3) — SELESAI ✅
- [x] **System Tray & Minimize to Tray (P3.1):** Berjalan di latar belakang dengan ikon area notifikasi OS, toggle hide/restore, pencegahan double shutdown, dan backgroundThrottling: false.
- [x] **Clear Chat Button (P3.2):** Tombol sekali klik untuk membersihkan tampilan obrolan di layar tanpa memutuskan koneksi live dan tanpa mereset statistik sesi.
- [x] **Font Size Adjustment (P3.3):** Opsi pengaturan ukuran teks obrolan (Kecil, Normal, Besar) yang diterapkan langsung tanpa reload dan tersimpan di `localStorage`.
- [x] **Bad Words / Chat Filter:** Penyaringan kata terlarang otomatis case-insensitive dengan proteksi regex (`***`).

---

## 📌 Phase 4 — Live Analytics & Export (P4) — SELESAI ✅
- [x] **Live Session Tracking:** Pelacakan otomatis durasi live, peak viewers, dan rata-rata penonton secara real-time.
- [x] **Top Donatur Leaderboard:** Peringkat 5 donatur teratas (*Top Gifters*) berdasarkan akumulasi diamond dan total gift.
- [x] **Session History Storage:** Penyimpanan riwayat sesi live secara lokal di `data/sessions.json` tanpa dependensi database berat.
- [x] **One-Click Data Export:** Fitur ekspor langsung laporan sesi live ke format CSV dan JSON melalui REST API.
