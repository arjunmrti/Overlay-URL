# Spotique — OBS Music Overlay

Overlay Now Playing + antrean (Up Next) untuk OBS, dibuat dengan Vite + React. Terhubung langsung ke Spotify memakai **Authorization Code + PKCE** langsung dari browser: tidak ada server, tidak ada client secret. Kalau Client ID belum diatur (atau pakai `?demo=1`), overlay tampil dalam mode demo.

## 1. Buat app di Spotify

1. Buka https://developer.spotify.com/dashboard lalu **Create app**, pilih **Web API**.
2. Di **Redirect URIs**, tambahkan alamat overlay kamu **persis sama**, termasuk garis miring di akhir:
   - Produksi (Vercel): `https://nama-project.vercel.app/`
   - Lokal: `http://127.0.0.1:5173/` (wajib `127.0.0.1`, bukan `localhost`)
3. Salin **Client ID**. Client Secret tidak dipakai dan jangan dimasukkan ke project.

> Catatan: per 2026, app Spotify mode Development butuh pemilik app punya **Spotify Premium**, dibatasi sekitar 5 user yang di-allowlist (User Management di dashboard), dan otorisasi bisa kedaluwarsa tiap beberapa bulan sehingga perlu login ulang. Cek aturan terbaru di dokumentasi Spotify. Pertimbangkan juga syarat developer Spotify untuk pemakaian di siaran live.

## 2. Pasang Client ID

Salin `.env.example` menjadi `.env`:

```
VITE_SPOTIFY_CLIENT_ID=client_id_kamu
```

Di Vercel: Project Settings → Environment Variables → tambahkan `VITE_SPOTIFY_CLIENT_ID`, lalu redeploy. (Alternatif tanpa env: tambahkan `?client_id=...` di URL.)

## 3. Jalankan

```bash
npm install
npm run dev     # buka http://127.0.0.1:5173
npm run build   # hasil di dist/
```

## 4. Pasang di OBS

1. Sources → **+** → **Browser Source**, URL: alamat overlay kamu, ukuran awal `300 × 860`.
2. Matikan opsi "Shutdown source when not visible" dan "Refresh browser when scene becomes active".
3. **Login pertama dilakukan di dalam OBS**: klik kanan source → **Interact** → **Hubungkan Spotify** → **Allow**. Token tersimpan di Browser Source itu, jadi tidak perlu login lagi.
4. Putar lagu di Spotify (app mana pun di akun yang sama). Overlay update tiap ±2,5 detik, progress dihaluskan di antaranya.

### Aplikasi tanpa menu Interact (mis. TikTok LIVE Studio)

1. Di browser biasa, buka `https://nama-project.vercel.app/?setup=1`, klik **Hubungkan Spotify**, login, dan Allow.
2. Halaman akan menampilkan sebuah link panjang. Klik **Salin link**.
3. Tempel link itu sebagai URL Link Source di aplikasi streaming. Sesi login ikut terbawa.

Link itu berisi refresh token: anggap seperti password. Kalau overlay suatu saat minta login lagi, ulangi langkah di atas untuk mendapat link baru. Untuk mencabut akses, hapus app dari https://www.spotify.com/account/apps.

Untuk logout / ganti akun: buka URL overlay dengan tambahan `?logout=1` sekali (lewat Interact), lalu hapus parameternya.

## Parameter URL

- `?mode=full|now-playing|queue` — tampilan (default `full`)
- `?compact=1` — lebih rapat
- `?count=5` — jumlah baris antrean (1–8)
- `?accent=%23ff4f87` — kunci warna aksen. Tanpa parameter ini, aksen otomatis mengikuti warna cover
- `?idle=hide` — sembunyikan overlay saat tidak ada lagu diputar
- `?demo=1` — paksa mode demo; di demo juga berlaku `title`, `artist`, `elapsed`, `duration`, `static=1`
- `?client_id=...` — Client ID alternatif selain env
- `?logout=1` — hapus sesi login

## Cara kerjanya

- Scope yang diminta hanya `user-read-playback-state` dan `user-read-currently-playing`.
- `GET /me/player` (lagu, play/pause, progress) dipoll tiap 2,5 detik saat memutar, 5 detik saat idle. `GET /me/player/queue` diambil saat lagu berganti dan tiap 10 detik.
- Access token diperbarui otomatis memakai refresh token; 401 memicu refresh, 429 dihormati lewat `Retry-After`.
- Spotify hanya mengembalikan sekitar 20 item antrean. Podcast ditampilkan dengan nama show sebagai artis.
- Kalau endpoint antrean membalas 403 (dibatasi untuk app kamu), panel menampilkan "Antrean tidak bisa diakses" dan bagian Now Playing tetap jalan.

## Tampilan

Tema glass: kartu kaca blur dengan tint gelap tipis, cover dengan glow blur dari gambar cover itu sendiri, dan latar overlay sepenuhnya transparan. Warna progress bar dan equalizer diambil otomatis dari cover (kalau gambar tidak bisa dibaca, dipakai warna default). Mode demo memakai cover SVG yang dibuat lewat kode, jadi project ini tidak berisi file gambar.
