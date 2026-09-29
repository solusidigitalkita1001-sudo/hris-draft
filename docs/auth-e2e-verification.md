# Verifikasi auth di browser sungguhan

Checklist item #4 menyisakan "E2E auth browser": semua perilaku sesi sejauh ini
diuji lewat unit/integration test, belum pernah dilihat berjalan di browser.
Dokumen ini mencatat hasil menjalankannya pada stack developer (frontend
`:5173`, backend `:3000`, MySQL/Redis/RabbitMQ dari `docker-compose.yml`) dengan
akun demo `maya@tech.com` (EMPLOYEE).

Yang diverifikasi di sini bukan tampilan, tapi tiga hal yang tidak bisa
dibuktikan oleh unit test: cookie mana yang benar-benar terbaca JavaScript,
urutan request saat token basi, dan ke mana pengguna dilempar saat sesinya
dimatikan.

## 1. Token tidak pernah tersentuh JavaScript

Setelah login, `document.cookie` hanya berisi satu nilai:

```
csrf=1790695466650-…
```

Access dan refresh token tidak terlihat — keduanya `httpOnly`. `localStorage`
berisi `groupId`, `companyId`, `employeeId`, `hrms_active_company`,
`hrms_last_activity`, `hrms_language`, `hrms-company-store`: identitas dan
preferensi, tanpa satu pun token. Ini yang membuat XSS tidak otomatis berarti
pencurian sesi.

## 2. Perubahan otoritas mematikan token lama pada request berikutnya

Menaikkan `session_version` pengguna di database meniru apa yang terjadi saat
admin mencabut role, mengubah permission sebuah role, atau menarik akses
perusahaan (lihat `shared/security/session-revocation.ts`). Urutan request yang
tercatat browser setelah itu:

```
GET  /api/v1/auth/me      → 401   token lama ditolak oleh isCurrentSession
GET  /api/v1/auth/csrf    → 200
POST /api/v1/auth/refresh → 200   user dibaca ulang, klaim baru dicetak
GET  /api/v1/auth/me      → 200   request semula diulang dan lolos
```

Pengguna tidak dipaksa login lagi dan tidak melihat apa pun selain jeda singkat,
tetapi token dengan otoritas lama sudah mati. Inilah perilaku yang dituju: tidak
ada jendela waktu di mana seseorang masih bertindak dengan hak yang sudah
dicabut.

## 3. Menonaktifkan akun langsung memutus sesi

Mengubah `users.status` menjadi `INACTIVE` pada sesi yang sedang berjalan:

```
GET  /api/v1/auth/me      → 401
GET  /api/v1/auth/csrf    → 200
POST /api/v1/auth/refresh → 403   validateUserStatus menolak
```

Klien membersihkan state lokalnya dan pindah ke `/login?reason=expired`,
sehingga halaman login bisa menjelaskan kenapa pengguna terlempar. Bedanya
dengan kasus 2 penting: perubahan otoritas dipulihkan oleh refresh, penonaktifan
akun tidak.

Tiga error di konsol selama pengujian (dua 401 dan satu 403) memang jalur yang
sedang diuji; tidak ada error lain.

## Status dan batasnya

Ini verifikasi manual yang direkam, **bukan** suite otomatis. Nilainya: perilaku
sesi kini terbukti di browser, bukan hanya di test yang memanggil service
langsung. Batasnya: tidak ada yang mencegahnya rusak diam-diam nanti.

Mengotomasinya butuh dua hal yang belum diputuskan: dependency `@playwright/test`
di frontend, dan satu step di `.github/workflows/ci.yml` (file protected) yang
menjalankan stack lalu spec-nya. Keduanya perlu izin eksplisit sebelum
dikerjakan.

Akun demo dikembalikan ke `ACTIVE` setelah pengujian dan login diverifikasi
kembali normal. `session_version` tetap naik satu — itu memang efek yang tidak
bisa dibatalkan dan tidak berbahaya.
