
## Otomasi (29 September 2026)

Verifikasi manual di atas kini punya penjaga: `frontend/e2e/auth-session.spec.ts`
dijalankan dengan `npm run test:e2e` dari direktori `frontend`.

Lima kasus yang dikunci:

1. login membawa ke dashboard;
2. cookie `at`/`rt` ada di jar browser tetapi **tidak** terbaca
   `document.cookie`, dan tidak ada bentuk JWT di local/session storage;
3. access token yang hilang dipulihkan transparan — suite menunggu respons
   `/auth/refresh` 200 yang sebenarnya, lalu memastikan pengguna tetap di
   halaman yang dituju dan cookie `at` kembali ada;
4. tanpa access maupun refresh cookie, pengguna dilempar ke
   `/login?reason=expired`;
5. logout menghapus cookie sesi.

Suite ini berbicara ke stack yang sudah berjalan, bukan menyalakannya sendiri —
backend butuh MySQL, Redis, dan RabbitMQ, dan itu urusan deployment, bukan
fixture test. Prasyaratnya:

```bash
# jalankan stack lebih dulu (lihat docs/integration-tests.md untuk infranya)
cd backend && npm run dev
cd frontend && npm run dev

cd frontend && npm run test:e2e
# opsional: E2E_BASE_URL, E2E_EMPLOYEE_EMAIL, E2E_EMPLOYEE_PASSWORD
```

`retries` sengaja 0: satu lolos palsu di sini lebih buruk daripada gagal, karena
retry justru akan menyembunyikan bug sesi yang tidak stabil — tepat jenis bug
yang menjadi alasan suite ini ada.

Dibuktikan bisa gagal: diarahkan ke port tanpa stack, kelimanya gagal dan
prosesnya keluar dengan status 1; terhadap stack hidup, lima lolos dua kali
berturut-turut.

Kasus yang **belum** diotomasi: kenaikan `session_version` dan penonaktifan akun,
karena keduanya menuntut tulisan langsung ke database di tengah sesi. Keduanya
tetap tercatat sebagai verifikasi manual di bagian 2 dan 3 di atas.

Belum ada step CI untuk ini — menjalankannya di CI berarti menyalakan MySQL,
Redis, RabbitMQ, backend, dan frontend dalam satu job, lalu menyentuh
`.github/workflows/ci.yml` yang protected. Perlu izin eksplisit dulu.
