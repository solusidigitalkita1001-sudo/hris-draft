
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

## Journey cuti di browser (29 September 2026)

Suite yang sama juga menutup alur yang paling sering dipakai karyawan:
`frontend/e2e/leave-self-service.spec.ts` — ajukan cuti, lihat statusnya di
daftar, pengajuan kedua pada tanggal sama ditolak, lalu dibatalkan.

Tiga hal yang ditemukan saat menulisnya, dan semuanya mengubah bentuk test-nya:

- **Saldo cuti dialokasikan per tahun, dan UI menolak mengirim untuk tahun tanpa
  alokasi.** Tanggal "jauh di masa depan" karena itu tidak menguji apa pun:
  requestnya tidak pernah terkirim. Yang menenangkan, penolakannya tidak senyap —
  dialog menyebut tahunnya dan mengarahkan ke HR. Perilaku itu kini ikut dikunci
  sebagai kasus tersendiri.
- **Aturan overlap itu nyata**, jadi test tidak boleh mengasumsikan database
  bersih: seed dan run sebelumnya sama-sama memegang pengajuan. Test berjalan
  menyusuri beberapa kandidat Senin sampai satu diterima, ketimbang gagal karena
  aturan yang justru bekerja.
- **Membereskan data lewat `fetch` mentah merusak test-nya sendiri.** Mutasi di
  luar aplikasi memutar token CSRF, sehingga pengajuan berikutnya dijawab 403
  sampai klien mem-bootstrap ulang — test melaporkan gangguan buatannya sendiri.
  Pembatalan kini lewat UI, memakai alur CSRF aplikasi.

Data demo tidak dirusak: setiap pengajuan yang dibuat test dibatalkan lagi, dan
baris seed tetap utuh.

## Temuan: refresh yang dibatalkan di tengah jalan mematikan sesi

Ditemukan 30 September lewat CI, bukan lewat pembacaan kode — dan hanya muncul
di CI karena bergantung pada waktu.

Rotasi refresh token bekerja seperti ini: setiap `POST /auth/refresh` yang
berhasil mencabut token lama dan mengirim token baru lewat `Set-Cookie`. Deteksi
penggunaan-ulang mengandalkan itu — token lama yang dipakai lagi dianggap
pencurian dan seluruh *family*-nya dicabut.

Konsekuensi yang belum pernah dicatat: kalau browser **membatalkan** request
refresh setelah server memprosesnya — misalnya pengguna menekan tautan atau
tombol kembali tepat saat refresh berjalan — server sudah merotasi tokennya,
tetapi `Set-Cookie` pada response yang dibatalkan tidak tersimpan. Browser
tinggal memegang token lama yang kini sudah dicabut. Refresh berikutnya ditolak
`Invalid refresh token`, dan pengguna dikembalikan ke halaman login meskipun
tidak melakukan kesalahan apa pun.

Jejaknya di CI: satu `POST /auth/refresh` berstatus `-1` (dibatalkan browser)
disertai `auth.token.refreshed` di log server, lalu refresh berikutnya dengan
token lama ditolak 401.

**Ini keputusan, bukan perbaikan yang bisa diambil sepihak**, karena semua jalan
keluarnya mengorbankan sesuatu:

1. **Masa tenggang token lama** (misalnya token yang baru dirotasi masih
   diterima 10 detik, mengembalikan token baru yang sama). Menghilangkan
   logout-palsu ini, tetapi melemahkan deteksi penggunaan-ulang tepat pada
   jendela waktu yang paling mungkin dipakai penyerang.
2. **Klien tidak boleh membatalkan refresh**: satu refresh tunggal (single
   flight) yang tidak ikut dibatalkan saat navigasi. Tidak melemahkan keamanan,
   tetapi hanya mempersempit peluangnya — tab yang ditutup tetap membatalkannya.
3. **Biarkan apa adanya**, dengan pemahaman bahwa sebagian kecil pengguna akan
   ter-logout tanpa sebab yang terlihat.

Seberapa sering ini terjadi pada pengguna nyata belum diukur. Yang pasti: ia
terjadi, dan penyebabnya bukan bug yang bisa dihilangkan tanpa memilih salah
satu dari tiga di atas.
