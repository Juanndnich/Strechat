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

## 📌 Phase 3 — Streamer Experience & Usability (P3) — SEDANG BERJALAN 🔄
- [x] **System Tray & Minimize to Tray (P3.1):** Berjalan di latar belakang dengan ikon area notifikasi OS, toggle hide/restore, pencegahan double shutdown, dan backgroundThrottling: false.
- [ ] **Clear Chat Button (P3.2):** Tombol sekali klik untuk membersihkan tampilan obrolan di layar tanpa memutuskan koneksi live.
- [ ] **Font Size Adjustment (P3.3):** Opsi pengaturan ukuran teks obrolan (Kecil, Normal, Besar) untuk kemudahan membaca dari jarak jauh.
- [ ] **Bad Words / Chat Filter:** Penyaringan kata terlarang dan spam pada overlay dan antarmuka.

---

## 📌 Phase 4 — Live Analytics & Export (Roadmap Lanjutan)
- [ ] Top Gifter Leaderboard selama sesi live berlangsung.
- [ ] Grafik riwayat jumlah penonton, suka, dan diamond.
- [ ] Ekspor riwayat sesi obrolan dan donasi ke format CSV / JSON.
