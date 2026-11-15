# strechat 🚀 (Panduan Bahasa Indonesia)

> **Aplikasi Desktop Ringan & Cepat untuk Memonitor Live Chat TikTok di Luar OBS.**  
> Pantau obrolan live TikTok, jumlah penonton, GIF & gift yang masuk, jumlah suka (likes), serta komentar secara real-time tanpa delay dengan tampilan minimalis font Poppins.

---

## 🌟 Fitur Utama strechat

1. **⚡ Pemantauan Real-Time Tanpa Delay (Zero-Delay)**:
   - Terhubung langsung ke aliran webcast TikTok menggunakan WebSocket lokal yang sangat responsif.
2. **👁️ Pemantau Jumlah Penonton (Live Viewers & Puncak)**:
   - Menampilkan jumlah penonton aktif saat ini dan mencatat rekor puncak penonton dalam satu sesi live.
3. **💖 Penghitung Suka & Animasi Detak Jantung**:
   - Jumlah tap suka bertambah otomatis dengan animasi detak jantung yang halus.
4. **🎁 Notifikasi Gift & GIF Interaktif**:
   - Spanduk animasi melayang saat ada penonton yang mengirim gift atau GIF.
   - Penghitung combo berulang (`x5`, `x10`, `x50`).
   - Akumulasi perolehan diamond / koin gift.
   - Suara lonceng sintetis prosedural via Web Audio API (tidak butuh file eksternal, anti gagal putar).
5. **💬 Aliran Komentar Bersih & Interaktif**:
   - Tampilan tipografi **Poppins** yang nyaman dibaca dan tidak melelahkan mata.
   - Lencana khusus penonton (**MOD**, **SUB**).
   - **Fitur Sematkan Pesan (Pin Message)**: Klik tombol pin pada komentar mana saja untuk menyematkannya di bagian atas agar tidak terlewat.
   - **Filter Cepat**: Filter obrolan berdasarkan *Semua*, *Pertanyaan Saja (?)*, *Moderator Saja*, serta kotak pencarian kata kunci langsung.
6. **🗣️ Text-To-Speech (TTS) Suara Otomatis**:
   - Dapat membacakan nama pengirim dan jenis gift yang masuk secara otomatis lewat suara sistem.
7. **📱 Fleksibel untuk Semua Perangkat (Multi-Device / LAN Mode)**:
   - Selain sebagai aplikasi desktop mandiri, Anda dapat membuka URL lokal (tersedia di menu Pengaturan) pada smartphone, tablet (iPad/Android), atau laptop kedua di jaringan Wi-Fi yang sama untuk dijadikan monitor cadangan di samping meja streaming.
8. **🛡️ Arsitektur Kompleks dan Aman**:
   - Sanitasi input ketat terhadap serangan XSS dan injeksi skrip.
   - Isolasi konteks Electron (Context Isolation & CSP).
   - Auto-reconnect dengan jeda bertingkat (*exponential backoff*) jika koneksi internet sempat terputus.
9. **🎮 Mode Demo Terintegrasi**:
   - Tombol bintang untuk mengaktifkan simulasi obrolan, gift, suka, dan penonton palsu secara realistis agar Anda bisa menguji tampilan dan animasi sebelum mulai streaming langsung.

---

## 🚀 Panduan Menjalankan Aplikasi

### 1. Persiapan
Pastikan komputer sudah terpasang **Node.js** (versi 18 ke atas) dan **Git**.

### 2. Instalasi Dependensi
Buka terminal / PowerShell di direktori proyek:
```bash
npm install
```

### 3. Menjalankan Aplikasi Desktop
```bash
npm start
```
Aplikasi desktop `strechat` akan langsung terbuka dengan tampilan frameless minimalis, tombol Always-on-Top (sematkan di atas layar), minimize, maximize, dan close.

### 4. Integrasi Langsung ke OBS Studio

#### A. Chat Overlay Transparan di Layar Stream (Browser Source)
1. Di OBS Studio, klik tombol **+** pada panel **Sources**.
2. Pilih **Browser**.
3. Beri nama (misal: `TikTok Chat Overlay`).
4. Masukkan URL: `http://localhost:3000/overlay`
5. Atur Width: `450`, Height: `600`.
6. Klik **OK**. Chat dan gift live TikTok akan muncul melayang secara transparan di atas layar stream Anda dengan animasi pop-in dan auto-fade!

#### B. Menempelkan Panel strechat ke dalam OBS (Custom Browser Docks)
1. Di menu atas OBS Studio, klik **Docks** -> **Custom Browser Docks...** (Dok Peramban Kustom).
2. Di kolom **Dock Name**, ketik: `strechat`.
3. Di kolom **URL**, masukkan: `http://localhost:3000`
4. Klik **Apply**. Panel lengkap strechat akan menempel langsung sebagai sidebar di jendela OBS Anda!

### 5. Menjalankan Mode Web / Server Saja
Jika ingin mengakses lewat browser komputer atau ponsel:
```bash
npm run server
```
Buka `http://localhost:3000` di browser Anda.

---

## 📦 Membuat File Installer Rilis GitHub (Windows, Mac, Linux)

Aplikasi telah dilengkapi konfigurasi `electron-builder` sehingga siap dikompilasi menjadi paket instalasi:

```bash
# Untuk Windows (.exe installer & portable):
npm run dist:win

# Untuk macOS (.dmg & .zip):
npm run dist:mac

# Untuk Linux (.AppImage & .deb):
npm run dist:linux
```
File executable (.exe) yang siap dibagikan kepada pengguna akan otomatis tersimpan di folder `dist/`.

---

## 🌐 Memublikasikan Rilis Pertama di GitHub

Untuk mempublikasikan versi awal (v1.0.0) ke GitHub:

1. **Inisialisasi & Commit ke Git**:
   ```bash
   git add .
   git commit -m "feat: inisialisasi strechat v1.0.0 - aplikasi pemantau live tiktok"
   ```

2. **Hubungkan ke Repositori GitHub Anda**:
   ```bash
   git branch -M main
   git remote add origin https://github.com/USERNAME-ANDA/strechat.git
   git push -u origin main
   ```

3. **Buat Tag Rilis**:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

4. **GitHub Actions Otomatis**:
   File `.github/workflows/build-release.yml` yang sudah kami sertakan akan secara otomatis menjalankan proses kompilasi rilis multi-platform (Windows, macOS, Ubuntu) dan mengunggah file instalasi ke tab **Releases** di repositori GitHub Anda.

---

## 📝 Lisensi
Proyek ini dilisensikan di bawah Lisensi MIT. Bebas dimodifikasi dan didistribusikan.
