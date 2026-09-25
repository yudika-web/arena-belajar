# Setup Arena Belajar — GitHub Pages + Admin + Cloudflare Worker

Konfigurasi paket ini sudah diarahkan untuk:
- GitHub owner: `yudika-web`
- Repository: `arena-belajar`
- Branch: `main`
- GitHub Pages: `https://yudika-web.github.io/arena-belajar/`
- Admin: `https://yudika-web.github.io/arena-belajar/admin/`

## 1. Buat repository GitHub

1. Buka GitHub → New repository.
2. Nama repository: `arena-belajar`.
3. Public direkomendasikan untuk GitHub Pages sederhana.
4. Upload **semua isi folder paket ini** ke root repository, termasuk folder `admin`, `assets`, `data`, dan `worker`.
5. Commit ke branch `main`.

## 2. Aktifkan GitHub Pages

Repository → **Settings → Pages**:
- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/(root)`
- Save

Setelah aktif, landing page akan berada di:
`https://yudika-web.github.io/arena-belajar/`

## 3. Buat Fine-grained Personal Access Token GitHub

GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.

Gunakan akses minimum:
- Repository access: **Only select repositories** → `arena-belajar`
- Repository permissions → **Contents: Read and write**

Tidak perlu memberi akses Issues, Actions, Pull Requests, Administration, dan lain-lain.

Salin token saat dibuat. Token ini nanti disimpan sebagai **Cloudflare Secret**, bukan di GitHub.

## 4. Buat Cloudflare Worker

Di Cloudflare Dashboard:
1. Workers & Pages → Create → Worker.
2. Nama misalnya: `arena-belajar-api`.
3. Buka editor kode Worker.
4. Salin seluruh isi `worker/worker.js`, tempel menggantikan kode contoh, lalu Deploy.

## 5. Tambahkan Variables dan Secrets

Worker → Settings → Variables and Secrets.

Tambahkan Variables biasa:
- `GITHUB_OWNER` = `yudika-web`
- `GITHUB_REPO` = `arena-belajar`
- `GITHUB_BRANCH` = `main`
- `ALLOWED_ORIGIN` = `https://yudika-web.github.io`

Tambahkan sebagai **Secret**:
- `GITHUB_TOKEN` = fine-grained PAT dari langkah 3
- `ADMIN_KEY` = password/kunci panjang buatan Anda sendiri

Contoh ADMIN_KEY yang baik: gunakan password manager untuk membuat string acak 24+ karakter. Jangan commit nilai ADMIN_KEY atau GITHUB_TOKEN ke repository.

Deploy ulang Worker jika diminta.

## 6. Catat URL Worker

Contoh:
`https://arena-belajar-api.NAMA-AKUN.workers.dev`

Tes di browser:
`https://arena-belajar-api.NAMA-AKUN.workers.dev/api/health`

Seharusnya muncul JSON dengan `"ok": true`.

## 7. Hubungkan halaman Admin

Buka:
`https://yudika-web.github.io/arena-belajar/admin/`

Isi:
- URL Cloudflare Worker
- ADMIN_KEY

Klik **Hubungkan**.

URL Worker disimpan di localStorage browser. ADMIN_KEY hanya disimpan di sessionStorage dan hilang ketika sesi browser ditutup.

Opsional: agar URL Worker langsung terisi di semua perangkat, edit `assets/config.js` dan isi `apiBaseUrl`. URL Worker bukan rahasia.

## 8. Uji commit otomatis

Di halaman Admin:
1. Klik `+ Tambah koleksi`.
2. Isi data.
3. Opsional upload gambar PNG/JPG/WebP/GIF maksimal 5 MB.
4. Klik `Simpan & commit`.

Worker akan:
1. membaca `data/koleksi.json` dari GitHub,
2. mengubah datanya,
3. bila ada gambar baru, upload ke `assets/images/`,
4. commit perubahan ke branch `main`.

GitHub Pages kemudian memublikasikan perubahan dari branch `main`.

## Catatan penting

- Menghapus koleksi hanya menghapus entri dari `data/koleksi.json`; file gambar lama sengaja tidak dihapus otomatis untuk mencegah kehilangan file yang mungkin masih digunakan.
- Upload gambar menghasilkan commit terpisah dari commit `koleksi.json`.
- Jika Anda memakai custom domain untuk GitHub Pages, ubah `ALLOWED_ORIGIN` di Worker menjadi origin custom domain tersebut, misalnya `https://belajar.example.com`.
- Jangan memasukkan `GITHUB_TOKEN` atau `ADMIN_KEY` ke `assets/config.js`, HTML, JavaScript frontend, atau file apa pun di repository.

## Troubleshooting

### `ADMIN_KEY salah`
Pastikan nilai yang Anda ketik sama persis dengan Secret `ADMIN_KEY` di Cloudflare.

### `Origin tidak diizinkan`
Pastikan `ALLOWED_ORIGIN` adalah origin halaman admin. Untuk GitHub Pages proyek ini nilainya `https://yudika-web.github.io` (tanpa `/arena-belajar`).

### `GitHub API: Resource not found`
Periksa owner, nama repository, branch, dan apakah fine-grained token benar-benar diberi akses ke repository `arena-belajar`.

### `GitHub API: Bad credentials`
Token salah, dicabut, atau sudah kedaluwarsa. Buat token baru lalu ganti Secret `GITHUB_TOKEN` di Worker.
