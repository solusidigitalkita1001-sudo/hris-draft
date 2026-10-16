# Pre-push: nol bug yang diketahui

Sebelum MENDORONG (push) perubahan apa pun ke git, semua gerbang di bawah
wajib lulus. Satu saja gagal → perbaiki dulu; jangan pernah push "nanti
dibenerin di commit berikutnya".

1. **Typecheck bersih** — `npx tsc --noEmit` di `backend/` (dan `frontend/`
   bila frontend tersentuh). Nol error, bukan "cuma warning".
2. **Test hijau, dibaca dari output mentah** — jalankan jest untuk semua
   modul yang tersentuh PLUS suite lintas-modul (`route-guard-coverage`,
   `route-security`, `api-contract`, `mobile-routes.contract`, seed tests).
   Verifikasi dari log/exit code asli, BUKAN dari ringkasan wrapper (rtk
   pernah salah rangkum).
3. **Suite integrasi MySQL nyata** — wajib dijalankan bila menyentuh
   payroll, uang, data-scope, atau skema DB (lihat
   `docs/integration-tests.md`; `--runInBand`).
4. **Migrasi utuh** — bila schema berubah: migrasi ter-generate, terdeploy
   bersih ke DB lokal, dan `prisma migrate diff` tidak menunjukkan drift.
5. **Build frontend lulus** — `npm run build` bila ada perubahan frontend;
   typecheck saja tidak cukup (rolldown/vite bisa gagal di hal yang tsc
   lewatkan).
6. **Smoke nyata untuk permukaan baru** — endpoint/route/layar baru dicoba
   minimal sekali terhadap server lokal yang berjalan (bukan hanya unit
   test), termasuk reseed bila permission/seed berubah.
7. **Baca ulang diff** — `git diff` penuh ditinjau sekali sebelum commit:
   tidak ada file nyasar, debug code, secret, atau perubahan tak disengaja.

Kalau ada temuan yang SENGAJA ditunda, itu bukan bug yang boleh ikut push
diam-diam: catat eksplisit di `docs/PROGRESS.md` dengan alasannya.
