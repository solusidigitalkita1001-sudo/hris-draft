# Checklist Perbaikan Lanjutan — Pasca Face Recognition Closed

Berdasarkan `re-review-7-face-recognition-closed.md`. Fokus: menutup gap besar terakhir (Menu Access & Data Access UI) dan validasi kematangan Face Recognition sebelum rollout luas.

Estimasi total: **3 minggu**
Asumsi tim: 2 Backend, 1 Frontend, 1 QA

---

## Minggu 1 — Validasi Kematangan Face Recognition (Sebelum Rollout Luas)

Target: pastikan fitur yang baru selesai dibangun benar-benar aman dipakai di produksi, bukan cuma lolos unit test.

| # | Task | Estimasi | Status | Acceptance Criteria |
|---|------|----------|--------|---------------------|
| 1.1 | **Ukur FAR/FRR** — siapkan dataset uji (minimal 30-50 pasang foto karyawan: foto asli vs foto orang lain, foto dengan variasi pencahayaan/sudut) untuk mengukur False Acceptance Rate dan False Rejection Rate dari threshold saat ini | 16h | ☐ | Laporan FAR/FRR dengan angka konkret, threshold di `DEFAULT_FACE_MATCH_THRESHOLD` disesuaikan kalau perlu |
| 1.2 | **Rate-limiting percobaan face-match gagal** — batasi jumlah percobaan clock-in gagal per employee per periode waktu (misal 5x/15 menit), lock sementara + notifikasi ke HR kalau melebihi | 12h | ☐ | Percobaan ke-6 dalam 15 menit → ditolak dengan pesan jelas, tercatat di audit log |
| 1.3 | **Evaluasi liveness upgrade**: putuskan apakah heuristic EXIF+blur cukup untuk fase ini, atau perlu upgrade ke challenge-response (misal: minta user berkedip/gerak kepala sesuai instruksi acak) | 8h (riset + keputusan) | ☐ | Dokumen keputusan dengan trade-off cost vs risiko, kalau upgrade → breakdown effort terpisah |
| 1.4 | **Staging test end-to-end**: uji alur lengkap enrollment → clock-in → berbagai skenario gagal (multiple faces, low confidence, model version mismatch, dimensi tidak cocok) di environment staging dengan Prisma Client ter-generate penuh | 12h | ☐ | Semua skenario di `docs/review.md` B.7 tervalidasi jalan di staging, bukan cuma lolos unit test |
| 1.5 | **Audit ukuran & retensi data foto**: pastikan foto asli (`selfieImage`) benar-benar tidak disimpan permanen setelah proses ekstraksi vector selesai (sesuai klaim di gap-analysis), cek log/temp storage tidak menyimpan copy tersembunyi | 6h | ☐ | Tidak ada foto asli tersimpan di disk/log setelah request selesai diproses |

### Exit Criteria Minggu 1
- [ ] Laporan FAR/FRR terdokumentasi dengan angka konkret
- [ ] Rate-limiting aktif dan teraudit
- [ ] Keputusan liveness upgrade terdokumentasi (baik lanjut atau tetap heuristic)
- [ ] Staging test end-to-end PASS untuk semua skenario edge case

---

## Minggu 2 — Menu Access (Admin UI)

Target: admin bisa atur per-role menu mana yang muncul, tanpa deploy kode.

| # | Task | Estimasi | Status | Acceptance Criteria |
|---|------|----------|--------|---------------------|
| 2.1 | **Schema `RoleMenuAccess`**: tabel relasi Role ↔ Menu Item (companyId-scoped, masuk `COMPANY_SCOPED_MODELS`) | 8h | ☐ | Migration jalan, model terdaftar di CompanyScope |
| 2.2 | **Seed default menu structure**: definisikan daftar menu item standar (Dashboard, Employee, Attendance, Payroll, Leave, dst) sebagai data referensi, bukan hardcode di frontend | 8h | ☐ | Menu item tersimpan di DB, bisa di-query per role |
| 2.3 | **API CRUD Menu Access**: `GET/PUT /rbac/roles/:id/menu-access` — assign/unassign menu item ke role | 12h | ☐ | Admin bisa toggle akses menu per role via API, tervalidasi dengan test cross-company |
| 2.4 | **Admin UI — Menu Access Matrix**: halaman dengan checklist matrix (role x menu item), simpan perubahan | 20h | ☐ | Admin buat role baru "Finance Only", centang cuma menu Payroll+Reports, user dengan role itu cuma lihat 2 menu di sidebar |
| 2.5 | **Frontend route guard berdasarkan Menu Access**: sidebar dan route protection baca dari `RoleMenuAccess`, bukan hardcode per role name | 12h | ☐ | User akses langsung via URL ke menu yang tidak di-assign → redirect/403, bukan cuma disembunyikan dari sidebar |

### Exit Criteria Minggu 2
- [ ] Admin bisa configure menu access per role dari UI tanpa deploy
- [ ] Route guard konsisten antara sidebar visibility dan actual access control

---

## Minggu 3 — Data Access Scope (Admin UI)

Target: admin bisa atur scope data yang bisa dilihat per role (misal: manager cabang hanya lihat data cabangnya).

| # | Task | Estimasi | Status | Acceptance Criteria |
|---|------|----------|--------|---------------------|
| 3.1 | **Schema `DataAccessScope`**: definisikan tipe scope (ALL, OWN_BRANCH, OWN_DEPARTMENT, OWN_DIVISION, CUSTOM_LIST) per role, per resource type (employee, attendance, payroll, dst) | 12h | ☐ | Migration jalan, model masuk CompanyScope |
| 3.2 | **Middleware Data Scope Enforcement**: extend `CompanyScope`/`RequestContext` yang sudah ada supaya baca `DataAccessScope` role user, inject filter tambahan (branchId/departmentId) ke query — pola yang sama seperti Prisma middleware yang sudah terbukti jalan | 20h | ☐ | Role "Branch Manager" dengan scope OWN_BRANCH → list employee otomatis terfilter ke branch user, tanpa perlu ubah kode di controller manapun |
| 3.3 | **Admin UI — Data Access Config**: halaman assign scope type per role per resource | 16h | ☐ | Admin set scope "Branch Only" untuk role tertentu dari UI |
| 3.4 | **Integration test cross-scope**: test user dengan scope OWN_BRANCH tidak bisa lihat data branch lain, meski masih dalam company yang sama | 12h | ☐ | Test PASS, pola sama seperti `company-scope-cross-company.test.ts` yang sudah ada |
| 3.5 | **Update `docs/review.md` dan `gap-analysis-vs-greatday.md`**: tandai Menu Access & Data Access sebagai selesai, dengan detail implementasi seperti pola dokumentasi yang sudah konsisten dipakai sejauh ini | 4h | ☐ | Dokumen ter-update akurat, living document tetap terjaga |

### Exit Criteria Minggu 3
- [ ] Data Access Scope berfungsi untuk minimal 1 use case nyata (branch-level restriction)
- [ ] Semua item besar dari `gap-analysis-vs-greatday.md` P0-P1 sudah tertutup
- [ ] Dokumentasi ter-update konsisten dengan kondisi kode aktual

---

## Ringkasan Timeline

| Minggu | Fokus | # Tasks |
|--------|-------|---------|
| 1 | Validasi kematangan Face Recognition sebelum rollout luas | 5 |
| 2 | Menu Access — Admin UI + route guard | 5 |
| 3 | Data Access Scope — Admin UI + enforcement middleware | 5 |
| **TOTAL** | **3 Minggu** | **15 tasks** |

---

## Prioritas Kalau Waktu Terbatas

1. **Task 1.2 (rate-limiting face-match)** — quick win, risiko brute-force kalau tidak ada ini, effort kecil (12h).
2. **Task 3.2 (Data Access middleware)** — ini yang paling bernilai karena polanya sudah terbukti jalan di CompanyScope, tinggal generalisasi konsepnya ke scope yang lebih granular.
3. Menu Access UI (Minggu 2) bisa menyusul — secara risk lebih rendah dibanding Data Access, karena RBAC dasar sudah menahan akses meski UI belum granular.

---

## Catatan

Checklist ini melengkapi (bukan menggantikan) checklist-checklist sebelumnya yang sudah ada di `.docs/`. Setelah Menu Access & Data Access selesai, seluruh item besar P0-P1 dari `gap-analysis-vs-greatday.md` akan tertutup — sisanya P2 (Engagement Portal, Multibank sudah selesai duluan, Basic Operational/Patrol untuk field worker) bisa jadi backlog berikutnya sesuai kebutuhan bisnis.
