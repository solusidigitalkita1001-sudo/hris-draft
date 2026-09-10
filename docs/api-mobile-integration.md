# HRIS API — Panduan Integrasi Mobile

Base URL: `http://<host>:8084/api/v1` (production saat ini masih HTTP — lihat catatan keamanan di bawah).

## Mode Autentikasi

API mendukung dua mode. Mobile **wajib** pakai mode Bearer:

| | Web (browser) | Mobile (native) |
|---|---|---|
| Penanda | (default) | Header `X-Client-Type: mobile` saat login/refresh |
| Token disimpan di | httpOnly cookie (`at`/`rt`) | Response body → simpan di secure storage (Keychain/Keystore) |
| Kirim auth | Cookie otomatis | Header `Authorization: Bearer <accessToken>` |
| CSRF | Wajib (double-submit) | **Tidak perlu** — request tanpa cookie auth otomatis dibebaskan dari CSRF |

## Alur Mobile

### 1. Login

```
POST /auth/login
X-Client-Type: mobile
Content-Type: application/json

{ "email": "user@company.com", "password": "..." }
```

Respons (`200`):

```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "email": "...", "roles": ["..."], "permissions": ["..."] },
    "tokens": {
      "accessToken": "<JWT — masa hidup 15 menit>",
      "refreshToken": "<opaque — masa hidup 7 hari>",
      "expiresIn": 900
    }
  }
}
```

- `422` = validasi gagal, `401` = kredensial salah, `401 MFA_REQUIRED` = kirim ulang dengan field `totp`, `429` = rate limit / akun terkunci 15 menit.
- Simpan kedua token di secure storage. **Jangan** di AsyncStorage/SharedPreferences polos.

### 2. Request ter-autentikasi

```
GET /employees
Authorization: Bearer <accessToken>
```

Tanpa cookie, tanpa CSRF. Berlaku untuk semua endpoint.

### 3. Refresh (saat access token expired / respons 401)

```
POST /auth/refresh
X-Client-Type: mobile
Content-Type: application/json

{ "refreshToken": "<refreshToken>" }
```

Respons sama seperti login (token baru di body). **Refresh token dirotasi
setiap kali** — selalu ganti simpanan dengan yang baru. Memakai ulang refresh
token lama akan me-revoke seluruh sesi (deteksi replay).

### 4. Logout

```
POST /auth/logout
Content-Type: application/json

{ "refreshToken": "<refreshToken>" }
```

Tidak butuh access token yang masih hidup. Seluruh keluarga refresh token sesi
itu di-revoke di server.

### MFA (jika diaktifkan user)

Login pertama balas `401` dengan kode `MFA_REQUIRED` → ulangi login dengan
`{ "email", "password", "totp": "123456" }` (TOTP 6 digit atau recovery code).

## Inventori Endpoint

Daftar lengkap route (method + path) tersedia di:

```
GET /meta/endpoints
Authorization: Bearer <accessToken admin>   (butuh permission rbac:read)
```

## Konvensi Respons

- Sukses: `{ "success": true, "data": ..., "message"?: ... }`; list membawa `meta: { page, limit, total, totalPages }`.
- Gagal: `{ "success": false, "code": "...", "message": "..." }` dengan HTTP status yang sesuai (`401` auth, `403` izin/scope, `404` tidak ditemukan/di luar tenant, `409` konflik/stale, `422` validasi, `429` rate limit).
- Field sensitif karyawan (NIK, NPWP, rekening, BPJS) **dimask last-4** kecuali user punya role HR/admin atau permission `employee:read-sensitive`.

## Catatan Keamanan

- Production masih HTTP polos; sampai HTTPS terpasang, token bisa disadap di
  jaringan. Pasang HTTPS sebelum rilis mobile publik, lalu aktifkan certificate
  pinning di aplikasi.
- Access token 15 menit; implementasikan auto-refresh pada 401 (sekali retry,
  antre request paralel selama refresh berlangsung).
- Rate limit login: 10 percobaan gagal / 15 menit per IP dan per email; 5
  kegagalan mengunci akun 15 menit.
