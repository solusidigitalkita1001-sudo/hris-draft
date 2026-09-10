# Perbaikan login / CSRF 304 — 10 September 2026

## Temuan pada server

Pemeriksaan read-only terhadap aset JavaScript publik dari `http://srv540825.hstgr.cloud:8083/login` menunjukkan URL API build adalah `http://srv540825.hstgr.cloud:8084/api/v1`.

Pada API port 8084, GET `/api/v1/auth/csrf` mengembalikan JSON 200 tanpa `Cache-Control`, body tanpa token, dan cookie `csrf` beratribut `Secure`. GET berikutnya dengan `If-None-Match` menghasilkan **304 tanpa body**. Browser yang mengakses hostname ini lewat HTTP menolak cookie Secure; karena frontend lama membaca `document.cookie`, bootstrap gagal. Cookie access/refresh juga memakai aturan Secure yang sama, sehingga hanya memperbaiki 304 belum cukup.

Port 8083 mengembalikan HTML SPA untuk `/api/v1/auth/csrf`; ini bukan URL API yang digunakan build server saat diperiksa. Jangan mengganti `VITE_API_URL` ke URL relatif sebelum proxy `/api/` di frontend benar-benar tersedia.

## Perubahan kode

- Semua respons router auth memakai `Cache-Control: private, no-store`, `Pragma: no-cache`, dan `Expires: 0`. Validator cache lama diabaikan, termasuk `If-None-Match: *`, agar respons auth selalu membawa body.
- Bootstrap mengembalikan `data.csrfToken` yang cocok dengan cookie bertanda tangan. Login dan refresh mengembalikan token CSRF hasil rotasi; access/refresh token tetap hanya dalam cookie HttpOnly.
- Frontend menyimpan token CSRF di memori dan menambahkan parameter unik pada bootstrap untuk melewati cache dari versi lama. Tidak bergantung pada akses JavaScript ke cookie API. HTML atau JSON tanpa token ditolak sebelum login dikirim.
- Bootstrap bersamaan berbagi satu request; penolakan CSRF mendapat satu retry. Automatic refresh juga bisa memperbarui CSRF kedaluwarsa. Respons 401 login/refresh tidak memicu refresh rekursif.
- `COOKIE_SECURE` menerima string `true` atau `false`. Tanpa override, production tetap Secure; development/test tidak Secure. Aturan berlaku konsisten pada pembuatan/penghapusan cookie auth dan CSRF. Validasi signature, lifetime, cookie/header, origin, HttpOnly auth, dan SameSite tetap berlaku.
- Konfigurasi Nginx repository tidak lagi menambahkan CORS wildcard di atas header origin/credentials milik Express.

## Penerapan untuk server HTTP saat ini

1. Tambahkan ke environment backend server:

   ```dotenv
   COOKIE_SECURE=false
   APP_URL=http://srv540825.hstgr.cloud:8084
   CORS_ORIGINS=http://srv540825.hstgr.cloud:8083
   ```

   Pertahankan origin lain yang masih dibutuhkan dalam daftar `CORS_ORIGINS`. Jangan mengubah `NODE_ENV` menjadi development untuk mengatasi cookie. HTTP tidak mengenkripsi kredensial/sesi; saat HTTPS tersedia, ubah `COOKIE_SECURE=true` dan sesuaikan URL/origin.

2. Pastikan nilai tersebut **masuk ke container**, bukan hanya tersedia pada file host. Bila Compose memakai blok `environment`, tambahkan pada setiap service API/replica:

   ```yaml
   environment:
     COOKIE_SECURE: ${COOKIE_SECURE:-true}
   ```

   Compose production lokal sudah menerima mapping ini, tetapi `docker-compose*.yml` diabaikan Git dalam repository ini: perubahan tersebut harus diterapkan juga pada Compose server. Jalankan Compose dengan `--env-file backend/.env` bila variabel berada di file itu. `environment` yang eksplisit mengalahkan `env_file`.

3. Build dan recreate backend terlebih dahulu, menggunakan Compose dan nama service yang sudah dipakai server. Untuk service `api`/`api-replica` pada layout repository:

   ```sh
   docker compose --env-file backend/.env -f docker-compose.prod.yml up -d --build --force-recreate api api-replica
   docker compose --env-file backend/.env -f docker-compose.prod.yml exec -T api printenv COOKIE_SECURE
   docker compose --env-file backend/.env -f docker-compose.prod.yml exec -T api-replica printenv COOKIE_SECURE
   ```

   Kedua pemeriksaan harus mencetak `false`. Restart saja tidak mengganti environment container. Pertahankan layout port/proxy server yang ada. Tidak ada migration untuk hotfix ini.

4. Build frontend dan sajikan `frontend/dist` terbaru:

   ```sh
   npm --prefix frontend ci
   VITE_API_URL=http://srv540825.hstgr.cloud:8084/api/v1 npm --prefix frontend run build
   ```

   Bila frontend disalin ke image/container, rebuild dan recreate container frontend juga. Jika memakai konfigurasi Nginx repository yang diperbarui, validasi `nginx -t` sebelum reload. Muat ulang halaman login setelah kedua build terpasang.

5. Verifikasi di Network browser: bootstrap menuju port **8084**, status **200**, content type JSON, `Cache-Control: private, no-store`, dan `data.csrfToken` terisi. Pada deployment HTTP, cookie `csrf`, `at`, dan `rt` tidak memiliki Secure; `at`/`rt` tetap HttpOnly. Login berhasil diikuti `/auth/me` 200; refresh dan logout tetap bekerja. Jangan membagikan nilai cookie/token/password saat mengirim hasil pemeriksaan.

## Verifikasi lokal dan batas

- 28 tes backend terkait auth/config/CSRF lulus, termasuk conditional GET, token JSON/cookie, dan alur agent HTTP bootstrap–login–refresh–logout. Service auth dimock; tes tidak mengakses akun/database produksi.
- Seluruh tes frontend **30 passed / 6 suites**, termasuk 12 tes API baru untuk bootstrap bersamaan, respons HTML/tanpa token, rotasi login/refresh, retry CSRF terbatas, 401 kredensial, dan pembersihan saat logout. Pemeriksaan `scripts/checks/p0-isolated.cjs` juga lulus.
- Typecheck dan build backend/frontend lulus. Lint tujuh file backend yang berubah: **0 error / 12 warning lama**; dua file frontend: **0 error / 0 warning**. Source di salinan verifikasi cocok SHA-256 dengan workspace. Build frontend masih melaporkan warning ukuran chunk yang sudah ada.
- Pemeriksaan live hanya membaca halaman, aset publik, dan endpoint bootstrap. Patch belum dideploy oleh agen dan login akun nyata belum diverifikasi. Validasi runtime Nginx server dilakukan saat rollout.
