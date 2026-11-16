# strechat 🚀

> **Aplikasi Pendamping & Pemantau Live TikTok Ringan, Zero-Delay untuk Desktop dan OBS Studio.**  
> Pantau aktivitas TikTok LIVE Anda di luar OBS secara real-time: jumlah penonton langsung, animasi gift, kecepatan suka (tap), papan peringkat donatur, analitik sesi, overlay transparan OBS, dan notifikasi audio/TTS.

[![Rilis](https://img.shields.io/badge/rilis-v1.0.0-indigo.svg)](https://github.com/Juanndnich/Strechat/releases)
[![Lisensi: MIT](https://img.shields.io/badge/Lisensi-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20OBS-blue.svg)](#)

---

## 🌟 Fitur Utama

- **⚡ Koneksi Langsung Webcast TikTok**: Terhubung langsung ke server resmi WebSocket Webcast TikTok (`piratetok-live-js`). 100% gratis tanpa biaya langganan EulerStream atau pihak ketiga.
- **👁️ Jumlah Penonton Langsung & Rekor Puncak**: Pantau penonton aktif dan rekor puncak penonton (*peak viewers*) dengan sinkronisasi polling otomatis setiap 6 detik.
- **💖 Penghitung Suka (Tap Layar)**: Animasi detak jantung interaktif saat penonton mengetuk layar live Anda.
- **🎁 Banner Gift Melayang Cerdas**:
  - Pool banner mengambang maksimal 2 kartu agar obrolan chat tidak pernah tertutup.
  - Pengelompokan combo gift berturut-turut (`x5`, `x10`, `x50`).
  - Perhitungan akumulasi koin dan diamond secara otomatis.
  - Nada lonceng (*chime*) prosedural melalui Web Audio API (0 KB file audio fisik).
- **📊 Analitik Sesi Live & Papan Peringkat Donatur**:
  - Rangkuman live: Durasi stream, peak viewers, rata-rata penonton, total diamond, dan total suka.
  - **Papan Peringkat Top 5 Donatur** terupdate secara real-time.
  - **Ekspor Laporan 1-Klik**: Unduh laporan lengkap sesi live dalam format **CSV** atau **JSON**.
- **💬 Aliran Obrolan Real-Time**:
  - Tipografi Poppins bersih dengan pilihan ukuran font (**Kecil**, **Normal**, **Besar**).
  - Tombol **Bersihkan Obrolan di Layar** tanpa memutus koneksi live dan tanpa mereset statistik sesi.
  - Bar **Sematkan Pesan (Pin Message)**.
  - **Filter Kata Kasar / Terlarang** otomatis dengan masking `***`.
  - Filter pill (*Semua*, *Hanya Gift*) dan pencarian pesan instan.
- **🎨 In-App Overlay Studio / Desainer Overlay OBS**:
  - **5 Pilihan Preset Desain**: *Classic Box*, *Modern Pill*, *Glassmorphism*, *Neon Glow*, dan *Borderless*.
  - **Kustomisasi Tipografi & Ukuran**: Dukungan Google Fonts aman (Poppins, Montserrat, Roboto, Inter, Bangers, Ubuntu) serta slider ukuran teks.
  - **Color Picker Fleksibel**: Pilih warna latar belakang bubble, warna nickname, dan warna pesan chat.
  - **4 Pilihan Animasi Masuk**: *Pop In*, *Slide In*, *Fade In*, *Bounce*.
  - **Timer Menghilang Otomatis (Auto-Fade)**: Atur durasi chat tetap di layar (misal 5s, 10s, 15s) sebelum memudar mulus.
  - **Live Preview Simulator**: Uji tampilan langsung di dalam aplikasi sebelum dipasang ke OBS.
  - **Tautan URL Independen**: URL otomatis dibuat berdasarkan konfigurasi Anda (misal: `/overlay?theme=neon&anim=slide`).
- **👥 Manajemen Multi-Profil Streamer**:
  - Simpan dan kelola banyak akun TikTok sekaligus.
  - Beralih antar profil akun hanya dengan 1 klik tanpa perlu mengetik ulang username.
- **🔐 Koneksi Sesi TikTok Aman & Auto-Connect**:
  - Hubungkan otomatis (*Auto-Connect*) saat aplikasi pertama kali dibuka.
  - Dukungan opsional `sessionid` tersimpan lokal untuk membuka live stream yang dibatasi usia (18+) atau khusus pengikut tanpa risiko kebocoran data (0% telemetry, tidak pernah dicatat ke endpoint publik).
- **🎬 Integrasi Penuh OBS Studio**:
  - **Overlay Transparan Chat (`http://localhost:3000/overlay`)**: Latar belakang transparan dengan outline teks kontras tinggi untuk *Browser Source* di OBS.
  - **OBS Custom Browser Dock (`http://localhost:3000`)**: Tempelkan panel dasbor langsung ke dalam jendela OBS Studio Anda.
- **📥 System Tray & Pemrosesan Latar Belakang**:
  - Sembunyikan aplikasi ke System Tray saat tombol tutup ditekan agar live monitoring tidak terganggu.
  - Suara notifikasi, TTS, dan stream overlay OBS tetap berjalan instan dengan `backgroundThrottling: false`.
- **🗣️ Text-To-Speech (TTS)**: Suara buatan otomatis membacakan nama pengirim gift dan jenis gift yang masuk.
- **📱 Akses Jaringan Lokal (HP / Tablet)**: Deteksi otomatis IP host untuk memantau dari smartphone atau tablet pada jaringan Wi-Fi yang sama.
- **🛡️ Keamanan Berlapis**: Context Isolation Electron, Sandbox Renderer ketat (`sandbox: true`), proteksi navigasi eksternal (`shell.openExternal`), dan sanitasi XSS.
- **🎮 Mode Demo Bawaan**: Simulasi obrolan, gift, dan suka secara realistis hanya dengan 1 klik untuk pengetesan layout sebelum mulai live streaming.

---

## 📦 Pemasangan & Panduan Memulai

### Prasyarat
- Node.js versi 18.0.0 atau lebih baru
- npm

### 1. Kloning & Pasang Dependensi
```bash
git clone https://github.com/Juanndnich/Strechat.git
cd Strechat
npm install
```

### 2. Jalankan Pengujian Unit Otomatis
```bash
npm test
```

### 3. Jalankan Aplikasi Desktop
```bash
npm start
```

### 4. Jalankan Server Web / Headless (Untuk Akses Browser / HP)
```bash
npm run server
```
Buka alamat `http://localhost:3000` di browser atau buka IP LAN yang muncul di terminal melalui browser ponsel Anda.

---

## 🎥 Panduan Integrasi OBS Studio

### A. Overlay Transparan Chat (Browser Source)
1. Di OBS Studio, pada panel **Sources**, klik tombol **+** -> pilih **Browser**.
2. Beri nama: `Strechat Overlay`.
3. Masukkan **URL**: `http://localhost:3000/overlay`
4. Atur **Width**: `480`, **Height**: `720` (sesuaikan dengan scene Anda).
5. Centang **Shutdown source when not visible** (opsional).
6. Klik **OK**. Gelembung chat transparan akan melayang di atas gameplay atau kamera Anda.

### B. Menempelkan Panel di Jendela OBS (Custom Browser Dock)
1. Di OBS Studio, buka menu atas: **Docks** -> **Custom Browser Docks...**
2. Pada kolom **Dock Name**, ketik: `Strechat Monitor`
3. Pada kolom **URL**, masukkan: `http://localhost:3000`
4. Klik **Apply**. Anda dapat menyeret dan menempelkan panel ini di mana saja di dalam OBS.

---

## 🛠️ Membangun File Installer Mandiri

Anda dapat mengompilasi `strechat` menjadi file installer aplikasi desktop:

```bash
# Untuk Windows (.exe installer NSIS & portable)
npm run dist:win

# Untuk macOS (.dmg & .zip)
npm run dist:mac

# Untuk Linux (.AppImage & .deb)
npm run dist:linux
```

Hasil berkas executable akan tersimpan di dalam folder `dist/`.

---

## 📄 Lisensi

Didistribusikan di bawah lisensi MIT. Lihat berkas [LICENSE](LICENSE) untuk informasi lebih lanjut.
