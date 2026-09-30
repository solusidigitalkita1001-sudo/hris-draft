# Single sign-on (OIDC) per perusahaan

GAP-37. Karyawan masuk dengan akun Google Workspace, Microsoft Entra, atau
penyedia OIDC lain milik perusahaannya, tanpa kata sandi terpisah di HRIS.

## Dua posisi yang disengaja

Keduanya berbiaya, dan keduanya sepadan.

### 1. SSO **mengautentikasi**, bukan membuat akun

`autoProvision` default **false**. Penyedia identitas membuktikan *siapa*
seseorang; ia tidak berhak memutuskan bahwa orang itu **boleh punya akun HRIS**.
Menyerahkan keputusan itu ke direktori berarti siapa pun yang punya mailbox
perusahaan — kontraktor, anak magang, mantan karyawan yang akunnya belum
dihapus dari direktori — bisa masuk ke sistem yang memuat gaji dan data pribadi
seluruh karyawan.

Dengan mati, alurnya: SSO mencocokkan email terverifikasi ke **pengguna yang
sudah ada di perusahaan itu**, atau menolak dengan pesan "minta HR membuat
akunnya lebih dulu".

### 2. Email yang belum terverifikasi ditolak

Penyedia yang mengizinkan pengguna mengisi email apa pun tanpa membuktikannya
akan menjadi jalur pengambilalihan akun: cukup klaim `direktur@perusahaan.com`
dan sistem akan mencocokkannya ke pengguna direktur. Klaim `email_verified`
harus bernilai benar (boolean `true` atau string `"true"` — penyedia berbeda
menuliskannya berbeda); nilai lain dianggap belum terverifikasi.

## Memasang

```bash
curl -X POST https://<host>/api/v1/auth/sso/providers \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{
    "name": "Google Workspace",
    "issuer": "https://accounts.google.com",
    "clientId": "<client id>",
    "clientSecret": "<client secret>",
    "allowedDomains": ["perusahaan.com"]
  }'
```

Discovery dijalankan **saat mendaftar**, bukan saat karyawan pertama mencoba
masuk: salah ketik issuer gagal di sini, di depan orang yang sedang
memasangnya. Responsnya memuat `redirectUri` yang harus kamu daftarkan di
konfigurasi penyedia identitas.

`allowedDomains` kosong berarti domain apa pun yang dikembalikan penyedia
diterima. Isi kalau tenant-mu hanya boleh masuk dengan email korporatnya.

## Alur login

```
GET /api/v1/auth/sso/start?company=<kode perusahaan>&returnTo=/leave
    → 302 ke penyedia (response_type=code, PKCE S256, state, nonce)
penyedia → GET /api/v1/auth/sso/callback?state=...&code=...
    → 302 ke aplikasi web, dengan cookie sesi sudah terpasang
```

Sesi yang dihasilkan **identik** dengan hasil login kata sandi: cookie `at`/`rt`
httpOnly yang sama, token CSRF yang sama, dicetak oleh helper yang sama. Itu
disengaja — dua implementasi sesi akan menyimpang cepat atau lambat.

Kegagalan tidak mengembalikan JSON, karena URL ini dibuka penyedia di browser
pengguna: ia mendarat di halaman login dengan `?sso=failed` atau `?sso=denied`.
Teks error dari penyedia tidak pernah diteruskan ke halaman.

## Yang diverifikasi pada ID token

Setiap butir di bawah adalah pemalsuan yang berhasil bila pemeriksaannya
dihilangkan:

| Pemeriksaan | Tanpa itu |
|---|---|
| Tanda tangan terhadap JWKS penyedia | siapa pun bisa menandatangani token sendiri |
| Algoritma harus RS256/384/512 | `alg: none` diterima; HS256 diverifikasi dengan client secret yang penyedia juga tahu (algorithm confusion) |
| `iss` sama dengan issuer terdaftar | token dari penyedia lain diterima |
| `aud` sama dengan client id | token yang diterbitkan untuk aplikasi lain diterima |
| `exp` (toleransi 30 detik) | token lama dipakai selamanya |
| `nonce` sama dengan upaya login ini | token yang didapat di tempat lain diputar ulang di sini |
| Dokumen discovery mengklaim issuer yang kita minta | metadata penyedia lain dipakai, dan seluruh cek `iss` setelahnya lolos terhadap otoritas yang salah |

Kunci publik diambil dari `jwks_uri` dan di-cache 10 menit, **tetapi** token
dengan `kid` yang belum pernah dilihat memicu pengambilan ulang — kalau tidak,
rotasi kunci rutin di sisi penyedia menjadi seluruh login gagal selama sepuluh
menit.

Tanpa dependensi baru: Node mengimpor JWK langsung
(`crypto.createPublicKey({ format: 'jwk' })`) dan `jsonwebtoken` memverifikasi
RS256 terhadapnya.

## Pagar lain

- **PKCE (S256)** pada setiap upaya: authorization code yang dicuri tidak bisa
  ditukar tanpa `code_verifier` yang hanya server ini punya.
- **`state` unik dan sekali pakai.** Upaya login dikonsumsi lewat update
  bersyarat `consumedAt: null` **sebelum** penukaran token, jadi dua callback
  bersamaan dengan state yang sama tidak bisa dua-duanya lanjut.
- **`returnTo` hanya menerima path relatif.** URL absolut dan
  protocol-relative (`//evil.com`) dibuang — open redirect di sini akan membuat
  halaman phishing bisa menyelesaikan login sungguhan lalu mendaratkan pengguna
  yang sudah terautentikasi di tempat pilihan penyerang.
- **SSRF.** Issuer adalah URL yang dipasang tenant dan **diambil server**, jadi
  ia dipagari oleh pagar yang sama dengan webhook: tidak boleh privat, loopback,
  `.internal`, atau metadata cloud; diperiksa ulang terhadap alamat hasil
  resolusi DNS saat setiap pengambilan; redirect tidak diikuti.
- **Akun yang terkunci tetap terkunci.** Login SSO menjalankan pemeriksaan
  status dan lockout yang sama dengan login kata sandi. Lockout adalah respons
  terhadap serangan pada akun itu; pintu depan kedua akan menganulirnya.
- **Client secret disimpan terenkripsi** (bukan hash — penukaran code
  membutuhkannya utuh) dan tidak pernah dikembalikan endpoint mana pun.
- **Upaya login kedaluwarsa dibersihkan** lewat `purgeExpiredAttempts()`.

## MFA berpindah ke penyedia identitas

Ini perlu kamu ketahui sebagai keputusan, bukan kelalaian: pada alur redirect
tidak ada tempat untuk memasukkan kode TOTP, dan penyedia identitas biasanya
baru saja menegakkan MFA-nya sendiri. Karena itu flag `twoFactorEnabled` lokal
**tidak** diperiksa ulang saat login SSO — ia hanya dicatat
(`mfaDelegatedToProvider`), supaya auditor bisa melihat login mana yang
mengandalkan penyedia untuk faktor keduanya.

Kalau kebijakanmu menuntut MFA, nyalakan di penyedia identitas.

## Verifikasi

25 test klien OIDC dengan **kunci RSA dan token sungguhan** (tiap pemalsuan di
tabel di atas diuji) dan 26 test layanan: state/nonce/PKCE tersimpan, open
redirect dibuang, upaya sekali pakai, callback bersamaan, email belum
terverifikasi, pembatasan domain, pencarian pengguna terkurung pada perusahaan
penyedia, penolakan saat akun tidak ada, dan secret yang tidak pernah keluar.
