# Password Recovery

Implementasi password recovery tersedia melalui endpoint publik berikut, relatif
terhadap `/api/v1`:

| Method | Path | Body | Response sukses |
|---|---|---|---|
| `POST` | `/auth/forgot-password` | `{ "email": "employee@example.com" }` | `202` dengan pesan generik |
| `POST` | `/auth/reset-password` | `{ "token": "...", "password": "..." }` | `200` |

Response forgot-password selalu sama untuk email yang ada maupun tidak ada.
Client tidak boleh menyimpulkan keberadaan akun dari response tersebut.

## Siklus hidup token

- Server membuat token acak 256-bit dan hanya menyimpan digest SHA-256.
- Token berlaku sesuai `PASSWORD_RESET_TTL_MINUTES` (default 15 menit).
- Hanya token terbaru yang aktif; permintaan baru membatalkan token lama.
- Token single-use dan diklaim secara atomik saat reset.
- Akun `ACTIVE` dan `LOCKED` dapat meminta reset. Akun lain tetap menerima
  response generik tanpa token aktif.
- Permintaan untuk user/email yang sama dibatasi satu kali per menit, di samping
  rate limit per IP pada route.
- Jika SMTP tidak aktif atau pengiriman gagal, token segera dinonaktifkan agar
  tidak ada grant yang tersisa tanpa email terkirim.

Reset yang berhasil mengganti password, membuka lockout login, menghapus catatan
percobaan login, menaikkan session version, membatalkan seluruh refresh token,
dan menghapus cookie auth. Setiap protected request membandingkan session version
di access token dengan user di database, sehingga access token yang terbit sebelum
reset langsung ditolak. Access token lama tanpa claim versi juga ditolak dan
client dapat memakai refresh rotation untuk memperoleh token format baru.

## Konfigurasi SMTP

Pengiriman email bersifat opt-in. Secret wajib berasal dari secret manager dan
tidak boleh disimpan di repository.

```env
SMTP_ENABLED=true
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=no-reply@example.com
SMTP_FROM_NAME=HRIS
PASSWORD_RESET_URL=https://app.example.com/reset-password
PASSWORD_RESET_TTL_MINUTES=15
```

`PASSWORD_RESET_URL` menerima query parameter `token` yang sudah di-URL-encode.
Gunakan HTTPS pada staging dan production.

## Database

Terapkan migration `20260920090000_password_reset_tokens` sebelum mengaktifkan
endpoint. Tabel `password_reset_tokens` menyimpan digest, waktu kedaluwarsa,
status penggunaan, IP peminta, dan relasi cascade ke user. Raw token tidak
disimpan di database maupun log.

## Error reset

Token yang tidak dikenal, kedaluwarsa, sudah dipakai, atau dibatalkan menghasilkan
HTTP `400` dengan code `PASSWORD_RESET_INVALID`. Password yang tidak memenuhi
kebijakan mengikuti error validasi API. Password baru yang sama dengan password
lama ditolak.

## Checklist deployment dan acceptance

1. Terapkan migration dan pastikan schema berstatus terbaru.
2. Konfigurasikan SMTP serta URL HTTPS melalui secret manager.
3. Verifikasi email dikenal dan tidak dikenal menghasilkan body `202` yang sama.
4. Verifikasi link yang dikirim hanya dapat dipakai sekali dan kedaluwarsa sesuai
   TTL.
5. Verifikasi reset membatalkan refresh token pada seluruh perangkat.
6. Verifikasi access token yang terbit sebelum reset langsung ditolak.
7. Verifikasi token, password, alamat email, dan credential SMTP tidak muncul di
   log atau artefak test.
8. Uji delivery, spam classification, SPF, DKIM, dan DMARC pada provider staging.

Test lokal utama berada di:

- `src/modules/auth/password-reset.service.test.ts`;
- `src/modules/auth/password-reset.routes.test.ts`;
- `src/shared/mail/MailService.test.ts`.
