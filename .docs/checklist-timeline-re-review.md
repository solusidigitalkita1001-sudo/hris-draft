# Checklist & Timeline Perbaikan — Temuan Re-Review Update Terbaru

Berdasarkan `re-review-update-terbaru.md`. Fokus: menutup gap antara klaim "253/253 GRAND TOTAL COMPLETE" dengan realita kode, sebelum lanjut fitur baru.

Estimasi total: **4 minggu**
Asumsi tim: 2 Backend, 1 Frontend, 1 QA

---

## Minggu 1 — CompanyScope Perluasan (CRITICAL, blocker utama)

Target: tutup cross-tenant leak di modul yang belum ter-cover Prisma middleware.

| # | Task | Estimasi | Status | Acceptance Criteria |
|---|------|----------|--------|---------------------|
| 1.1 | Tambahkan `Employee`, `EmployeeFamilyMember`, `EmployeeEducation`, dst ke `COMPANY_SCOPED_MODELS` di `prisma.ts` | 8h | ☐ | Query employee company A dari user company B → NotFound, bukan 200 |
| 1.2 | Tambahkan `Attendance`, `AttendanceSummary` ke scoped models | 6h | ☐ | Cross-tenant attendance query → NotFound |
| 1.3 | Tambahkan `Branch`, `Division`, `Department`, `Position`, `CompanyGroup` (organization module) | 8h | ☐ | Cross-tenant organization CRUD → NotFound/403 |
| 1.4 | Tambahkan `SalaryComponent`, `EmployeeSalary`, `PayrollPeriod`, `PayrollRun`, `Payslip` | 8h | ☐ | Cross-tenant payroll read/write → NotFound |
| 1.5 | Tambahkan `Asset`, `Benefit`, `Document`, `OnboardingTask`, `JobPosting`, `Candidate`, `TrainingProgram` | 8h | ☐ | Semua modul sisa ter-cover |
| 1.6 | Integration test cross-company untuk semua model baru di atas (pola sama seperti `company-scope-cross-company.test.ts` yang sudah ada) | 16h | ☐ | Test suite hijau, minimal 1 test per model baru |
| 1.7 | Regression check: pastikan middleware baru tidak break SUPER_ADMIN/GROUP_ADMIN bypass yang sudah ada | 4h | ☐ | Super admin tetap bisa akses lintas company seperti sebelumnya |

### Exit Criteria Minggu 1
- [ ] Semua 11 modul yang disebut di finding #3 `review.md` sudah masuk `COMPANY_SCOPED_MODELS`
- [ ] Test suite cross-tenant baru 100% PASS
- [ ] Tidak ada regresi di 47 test cross-company yang sudah ada dari Fase A

---

## Minggu 2 — Auth Hardening & IDOR Cleanup

| # | Task | Estimasi | Status | Acceptance Criteria |
|---|------|----------|--------|---------------------|
| 2.1 | Pindahkan access & refresh token dari `localStorage` ke httpOnly cookie (`api.ts`, `auth.service.ts` frontend + backend set-cookie) | 16h | ☐ | DevTools → Application → localStorage kosong dari token. Cookie punya flag HttpOnly, Secure, SameSite |
| 2.2 | Update axios/fetch interceptor untuk `withCredentials: true`, hapus logic manual attach `Authorization` header dari localStorage | 8h | ☐ | Request tetap authenticated tanpa header manual, refresh flow tetap jalan |
| 2.3 | Verifikasi ulang 7 sub-entity Employee (family, education, skill, training, experience, emergency contact, attachment) — pastikan ownership check `employeeId` match | 12h | ☐ | Update/delete sub-entity employee lain → NotFound/403 |
| 2.4 | Verifikasi & validasi `employee-loan` create terhadap `LoanType.maxAmount`/`maxTenor` | 6h | ☐ | Create loan melebihi max amount/tenor → ValidationError |
| 2.5 | Maker-checker payroll: pisahkan permission `payroll:approve` vs `payroll:disburse` | 6h | ☐ | User dengan approve saja tidak bisa disburse tanpa permission terpisah |

### Exit Criteria Minggu 2
- [ ] Token tidak lagi di localStorage, verified via browser DevTools
- [ ] 7 sub-entity employee sudah ada ownership check
- [ ] Employee loan tidak bisa dibuat melebihi limit LoanType
- [ ] Payroll approve & disburse permission terpisah

---

## Minggu 3 — Face Recognition: Keputusan & Wiring Nyata

| # | Task | Estimasi | Status | Acceptance Criteria |
|---|------|----------|--------|---------------------|
| 3.1 | Keputusan build vs partner: evaluasi client-side model (face-api.js/TensorFlow.js/MediaPipe) vs API pihak ketiga (AWS Rekognition/Azure Face/Face++) untuk face detection & embedding extraction | 8h (riset) | ☐ | Dokumen keputusan dengan estimasi biaya per-transaksi & latency |
| 3.2 | Implementasi face detection + embedding extraction (sesuai keputusan 3.1) — baik di client (mobile/web camera capture → model lokal) atau server (kirim foto ke API pihak ketiga → terima vector) | 24h | ☐ | Selfie foto asli → `selfieVector` ter-generate otomatis, bukan manual di-mock di request body |
| 3.3 | Hubungkan hasil embedding ke `compareFaceVectors()` yang sudah ada (logic ini TIDAK perlu diubah, sudah benar) | 4h | ☐ | End-to-end: upload selfie → face terdeteksi → vector dibandingkan → hasil match/reject |
| 3.4 | Update dokumentasi progress: ubah status Face Recognition dari "✅ DONE" jadi status yang presisi (misal "Comparison logic DONE, Detection/Extraction pending" sampai 3.2 selesai) | 2h | ☐ | Dokumen progress mencerminkan status akurat |
| 3.5 | Re-evaluasi Liveness Check: putuskan apakah heuristik EXIF+blur saat ini cukup untuk MVP, atau perlu upgrade ke liveness model (blink detection/challenge-response) | 4h (riset) | ☐ | Dokumen keputusan dengan trade-off cost vs security |

### Exit Criteria Minggu 3
- [ ] Face recognition berfungsi end-to-end dari foto asli, bukan cuma vector yang di-mock
- [ ] Dokumentasi progress akurat, tidak overclaim
- [ ] Keputusan liveness check terdokumentasi

---

## Minggu 4 — Verifikasi Tersisa & Company Settings

| # | Task | Estimasi | Status | Acceptance Criteria |
|---|------|----------|--------|---------------------|
| 4.1 | Verifikasi & implementasi service/controller untuk `CompanySetting`, `GroupSetting`, `GroupPolicy` (finding #17 review.md — table ada, 0% dipakai) | 16h | ☐ | Minimal 1 setting (misal fiscal year start / currency) bisa di-set & dibaca via API |
| 4.2 | Bangun fitur potongan gaji otomatis berdasarkan telat/absen (terhubung ke `BranchAttendancePolicy` + Company Settings baru) | 20h | ☐ | Karyawan telat > toleransi → otomatis ada deduction component di payslip |
| 4.3 | Full regression test suite (`npx jest` full run, bukan cuma `src/shared`) — pastikan semua perbaikan minggu 1-3 tidak saling break | 8h | ☐ | Semua test suite PASS termasuk integration test yang butuh Prisma client & DB |
| 4.4 | Update `docs/review.md` jadi living document — tandai status tiap finding (✅ Fixed / 🔶 Partial / ☐ Open) sesuai kondisi terkini | 4h | ☐ | Setiap 19 finding di review.md ada status terbaru + tanggal verifikasi |

### Exit Criteria Minggu 4
- [ ] Company Settings modul fungsional minimal untuk 1 use case (potongan telat/absen)
- [ ] Full test suite (bukan cuma pure-function) PASS
- [ ] `docs/review.md` ter-update sebagai living document, bukan snapshot statis

---

## Ringkasan Timeline

| Minggu | Fokus | # Tasks |
|--------|-------|---------|
| 1 | CompanyScope perluasan ke 11 modul yang belum tercover | 7 |
| 2 | Auth hardening (token httpOnly) + IDOR cleanup + maker-checker payroll | 5 |
| 3 | Face recognition wiring nyata (detection+embedding) + liveness re-evaluasi | 5 |
| 4 | Company Settings + potongan telat/absen + regression + living doc | 4 |
| **TOTAL** | **4 Minggu** | **21 tasks** |

---

## Prioritas Kalau Tim/Waktu Terbatas

Kalau tidak bisa kerjakan semua dalam 4 minggu, urutan yang tidak bisa ditawar:

1. **Minggu 1 (CompanyScope perluasan)** — ini data gaji & PII karyawan yang bocor lintas company kalau tidak ditangani. Risiko finansial & legal langsung.
2. **Task 2.1 (token httpOnly)** — celah XSS yang sudah lama terbuka, fix-nya relatif cepat (16h) untuk risk yang dikurangi besar.
3. Sisanya (Face Recognition wiring, Company Settings) bisa menyusul — bukan celah keamanan, tapi gap fungsional yang mempengaruhi kelengkapan fitur.

---

## Catatan

Checklist ini melengkapi (bukan menggantikan) `timeline-checklist.md` dan `timeline-checklist-greatday-parity.md` yang sudah ada. Sebelum lanjut ke Fase E backlog atau fitur GreatDay parity berikutnya, selesaikan checklist ini dulu — supaya "100% complete" di dokumen progress berikutnya benar-benar mencerminkan kondisi produksi, bukan cuma pure-function test yang hijau.
