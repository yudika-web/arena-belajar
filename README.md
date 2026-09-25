# Arena Belajar / Arena IPA

Landing page GitHub Pages dengan dashboard Admin yang menyimpan koleksi ke `data/koleksi.json` melalui Cloudflare Worker dan GitHub REST API.

## URL setelah deploy
- Landing: `https://yudika-web.github.io/arena-belajar/`
- Admin: `https://yudika-web.github.io/arena-belajar/admin/`

## Mulai
Baca **SETUP.md** dan ikuti dari langkah 1 sampai 8.

## Struktur
```text
arena-belajar/
├── index.html
├── admin/index.html
├── assets/
│   ├── app.js
│   ├── style.css
│   ├── admin.js
│   ├── admin.css
│   └── config.js
├── data/koleksi.json
├── worker/
│   ├── worker.js
│   └── wrangler.toml.example
├── SETUP.md
└── README.md
```

**Jangan pernah commit `GITHUB_TOKEN` atau `ADMIN_KEY`.** Keduanya harus disimpan sebagai Cloudflare Worker Secrets.
