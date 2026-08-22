# Re-Review: Verifikasi Update Terbaru hris-draft

Metodologi: bukan cuma baca `.docs/greatday-parity-progress-phase-A.md` & `phase-B.md`, tapi clone ulang repo, `npm install`, jalankan test suite beneran, dan baca source code langsung untuk cross-check klaim vs realita. Juga ditemukan `docs/review.md` — review independen yang sudah ada di repo kalian sendiri, isinya beberapa temuan CRITICAL yang sepertinya belum semua tercermin di narasi "253/253 GRAND TOTAL COMPLETE".

---

## 1. Yang Terverifikasi Genuine

| Klaim | Verifikasi Gw | Hasil |
|---|---|---|
| 225/225 pure Jest tests PASS (shared folder) | Gw jalanin ulang `npx jest src/shared` | ✅ **225/225 PASS**, match persis |
| PPh21 engine sesuai UU HPP 2022 | Baca `pph21.ts` manual — PTKP TK/0=54jt, +4.5jt kawin/tanggungan (max 3), bracket 5/15/25/30/35% | ✅ Benar |
| BPJS JKN cap 12jt + split 1%/4% | Baca `bpjs.ts` + jalankan test | ✅ Benar |
| Workflow engine terintegrasi ke 5 modul (leave/loan/trip/claim/shiftswap/overtime) | Cek `prisma.ts` — `COMPANY_SCOPED_MODELS` beneran include `LeaveRequest, LeaveBalance, Loan, BusinessTrip, ExpenseClaim, ShiftSwapRequest, OvertimeRequest` | ✅ Kode beneran ada, bukan cuma di dokumen |
| Privilege escalation RBAC (finding #1 di `review.md`) sudah di-fix | Baca `rbac.service.ts` — ada comment eksplisit "Privilege escalation guard" + check `scope === 'GLOBAL'` | ✅ Sudah diperbaiki |
| `findMyPayslips` IDOR (finding #4 review.md) sudah di-fix | Baca `payroll.controller.ts` — comment eksplisit "cegah intip slip gaji orang lain", employeeId dari `req.user` | ✅ Sudah diperbaiki |
| Overtime/attendance masuk payroll (finding #6 review.md) sudah di-fix | Baca `payroll.service.ts` `calculatePayroll()` — beneran query `approvedOvertimes`, `attd.present`, `leaveByEmployee`, bukan hardcode 0 | ✅ Sudah diperbaiki (kontradiksi langsung dengan temuan lama di review.md, artinya ini fix yang terjadi setelah review.md ditulis) |

**Kesimpulan bagian ini**: tim kalian genuinely mengerjakan sebagian besar temuan `review.md` DAN scope Fase A-B dari timeline GreatDay parity. Ini bukan kerja kosmetik/dokumentasi doang.

---

## 2. Temuan yang MASIH Terbuka (Terverifikasi Langsung, Belum Diperbaiki)

### 🔴 CompanyScope hanya menutup 12 model, BUKAN semua modul

Ini yang paling penting untuk diluruskan. Dokumen `greatday-parity-progress-phase-A.md` bilang **"Fase A Exit Criteria 100% COMPLETED"** dengan **"CompanyScope test suite hijau: 47/47 test PASS"**. Itu klaim yang **benar**, TAPI scope-nya sempit:

```
COMPANY_SCOPED_MODELS = LeaveRequest, LeaveBalance, Loan, BusinessTrip,
ExpenseClaim, ShiftSwapRequest, OvertimeRequest, + WorkflowTemplate/Instance/Step/Log
```

Cuma 12 model, semuanya yang terhubung ke workflow-engine (scope Fase A). Sementara `docs/review.md` (finding #3, CRITICAL) menyebutkan **9+ modul lain** yang masih rawan cross-tenant data leak:

```
employee, attendance, organization, payroll, asset, benefit,
document-management, onboarding, recruitment, reports, training
```

Gw cek — modul-modul ini **memang tidak ada** di `COMPANY_SCOPED_MODELS`. Jadi klaim "Fase A 100% selesai" itu **teknis benar untuk scope-nya sendiri**, tapi kalau dibaca sebagai "sistem sekarang aman dari cross-tenant leak" — itu **belum benar**. Payroll (data gaji!), Employee (PII!), Organization masih berpotensi bisa diakses lintas company kalau pola lama (`companyId` dari query/body client) masih dipakai di modul-modul itu.

**Rekomendasi**: perluas `COMPANY_SCOPED_MODELS` di `prisma.ts` untuk cover minimal: `Employee`, `Attendance`, `Payroll` (semua sub-model: `SalaryComponent`, `EmployeeSalary`, `PayrollPeriod`, `PayrollRun`, `Payslip`), `Branch`, `Division`, `Department`, `Asset`, `Benefit`, `Document`, `OnboardingTask`, `JobPosting`/`Candidate`, `TrainingProgram`. Ini bukan kerjaan baru dari nol — polanya sudah terbukti jalan di 12 model yang sudah ada, tinggal generalisasi.

### 🔴 Refresh/access token masih di `localStorage`

`review.md` finding #12 — gw cek `frontend/src/services/api.ts` & `auth.service.ts`, token masih `localStorage.setItem/getItem`. **Belum diperbaiki.** Satu celah XSS bisa curi token, membuat semua kerja keras refresh-token-rotation di backend jadi percuma. Pindahkan ke httpOnly cookie.

### 🟠 "Face Recognition" di Fase B: cuma logic pembanding, bukan face recognition beneran

Ini penting untuk diluruskan sebelum dipasarkan sebagai fitur "DONE". Gw baca `face-recognition.ts` — isinya cuma **cosine similarity comparison** antara dua vector angka (`compareFaceVectors(reference, selfie, threshold)`). Ini valid & bagus sebagai **layer keputusan**, tapi:

- Tidak ada proses **deteksi wajah dari foto** (face detection)
- Tidak ada proses **ekstraksi embedding/vector dari gambar** (face encoding)
- Kode di `attendance.service.ts` **mengasumsikan** `selfieVector` sudah dikirim dari client dalam bentuk array angka siap pakai

Artinya: fitur ini **belum bisa jalan di dunia nyata** kecuali ada komponen tambahan (client-side ML model seperti face-api.js/TensorFlow.js, atau API pihak ketiga seperti AWS Rekognition/Azure Face) yang benar-benar mengubah foto selfie jadi vector. Progress doc menyebut ini "✅ DONE" dengan 16/16 test — test itu benar PASS, tapi yang dites adalah **matematika perbandingan vector**, bukan "bisakah sistem mengenali wajah dari foto". Gap teknisnya masih besar untuk fitur ini jadi fungsional end-to-end.

**Liveness check** juga perlu diluruskan ekspektasinya: implementasinya heuristik ringan (cek EXIF metadata kamera + variance pixel untuk deteksi blur/foto galeri), bukan liveness detection real-time (blink/challenge-response). Ini pendekatan yang wajar untuk MVP, tapi jangan dipasarkan setara dengan liveness detection GreatDay yang kemungkinan pakai model ML dedicated.

### 🟡 Belum Sempat Diverifikasi Ulang (Perlu Dicek oleh Tim)

Dari `review.md`, item berikut **belum gw verifikasi ulang** apakah sudah fix atau belum (waktu review terbatas) — sebaiknya tim cek manual:
- Finding #5: IDOR di 7 sub-entity Employee (family, education, skill, dll)
- Finding #8: Maker-checker payroll approve vs disburse
- Finding #9: Validasi employee-loan terhadap `LoanType.maxAmount/maxTenor`
- Finding #17: `CompanySetting`/`GroupPolicy` table 0% dipakai

### 🟡 E-Signature, EWA, Mobile App — sudah dilabel jujur oleh tim, bukan overclaim

Beda dengan Face Recognition, untuk 3 item ini progress doc kalian sudah cukup jujur soal batasannya:
- **E-Signature (D.3)**: yang dibangun adalah decision matrix pemilihan provider + FSM state transition + validator NIK/email/phone. Integrasi API beneran ke Privy/Digisign/PERURI **belum ada** (dan memang belum diklaim ada).
- **EWA (C.4)**: logic max-allowed-percent + state machine, model "employer-funded float" in-house. Integrasi partner finansial/bank disbursement **belum ada** (sesuai keputusan riset C.3 yang didokumentasikan sebagai keputusan strategis terpisah).
- **Mobile App (D.6)**: cuma decision scorer (Expo vs RN vs Flutter vs KMP), bukan aplikasi jadi. Ini juga sudah dilabel sebagai "scoping document", bukan "app selesai".

Ini bagus — tim kalian jujur soal ini, beda dengan framing Face Recognition yang agak overclaim di ringkasan progress doc.

---

## 3. Kesimpulan & Rekomendasi Prioritas

**Progress teknis kalian real dan cukup impresif** — bukan cuma dokumentasi kosong. Tapi framing **"253/253 GRAND TOTAL PASS, Fase A-E 100% COMPLETE"** perlu dikoreksi jadi lebih presisi: itu artinya *unit business-logic Fase A-E sudah benar secara matematis/aturan*, BUKAN *sistem sudah aman & fitur sudah fungsional end-to-end*. Dua hal beda.

Urutan prioritas sebelum lanjut ke fitur baru:

1. **Perluas CompanyScope Prisma middleware** ke semua model, bukan cuma 12 yang terkait Fase A. Ini gap CRITICAL yang paling berbahaya (data gaji & PII bisa bocor lintas company).
2. **Pindahkan token ke httpOnly cookie** — celah XSS masih terbuka.
3. **Verifikasi ulang** 4 finding `review.md` yang belum gw cek (#5, #8, #9, #17).
4. **Luruskan status Face Recognition** — putuskan mau bangun face detection/embedding sendiri (client-side model) atau integrasi API pihak ketiga, sebelum fitur ini dianggap "selesai" di roadmap manapun.
5. Baru lanjut ke fitur GreatDay parity berikutnya yang belum disentuh (kalau ada sisa dari Fase E backlog).

Saran praktis: jadikan `docs/review.md` dokumen hidup — update statusnya (✅/🔶/☐) setiap kali satu temuan diperbaiki, supaya tidak ada lagi gap antara "klaim progress" dan "realita kode" seperti yang gw temukan hari ini.
