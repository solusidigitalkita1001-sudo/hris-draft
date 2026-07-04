# Tasklist Implementasi Attendance Dinamis Berbasis Kalender Kerja Karyawan

## Status Umum

- Status dokumen: `Draft`
- Fokus utama: attendance yang `branch-aware`, `policy-driven`, dan tetap berbasis `kalender kerja karyawan`
- Source of truth jadwal kerja: `resolved employee work calendar`
- Scope awal: backend domain, API, data model, web admin UI, dan readiness fingerprint

## Prinsip Desain

- Attendance tidak boleh hanya berbasis `companyId`; harus mempertimbangkan `branch aktif` karyawan.
- Source of truth jam kerja dan hari kerja tetap berasal dari `kalender kerja karyawan`.
- Policy branch berfungsi sebagai `layer enforcement`, bukan pengganti kalender kerja.
- Sistem harus mendukung kondisi dinamis seperti:
  - karyawan pindah branch
  - secondment sementara
  - branch beda metode absensi
  - radius GPS berbeda per branch
  - perubahan policy di masa depan tanpa merusak histori attendance lama
- Setiap attendance record harus menyimpan cukup konteks agar hasil historinya tetap konsisten walau policy berubah.

## Hierarki Resolusi Yang Wajib Dipakai

### Kalender Kerja Karyawan

- Tetap gunakan resolusi kalender kerja karyawan yang ada:
  - department calendar
  - branch calendar
  - company calendar
- Tambahkan evaluasi `active assignment` agar branch kerja aktual karyawan bisa berbeda dari `employee.branchId` permanen.
- Pastikan resolusi kalender mendukung tanggal efektif, bukan hanya data employee saat ini.

### Attendance Policy

- Attendance policy harus di-resolve berdasarkan `branch kerja aktif` pada tanggal attendance.
- Jika policy branch tidak ada, fallback ke `company-level attendance default policy`.
- Policy yang dipakai saat attendance dibuat harus disimpan sebagai snapshot minimal.

## Daftar Task Prioritas

### Prioritas 1 — Fondasi Model Data Attendance Policy

- Tambahkan model `BranchAttendancePolicy`.
- Tambahkan fallback model `CompanyAttendancePolicy` atau default policy attendance level company.
- Tambahkan enum metode absensi:
  - `FINGERPRINT`
  - `MOBILE_GPS`
  - `BOTH`
  - `MANUAL`
- Tambahkan field policy minimum:
  - `branchId`
  - `attendanceMethod`
  - `gpsLatitude`
  - `gpsLongitude`
  - `gpsRadiusMeters`
  - `allowOutsideRadius`
  - `outsideRadiusAction`
  - `lateToleranceMinutes`
  - `earlyCheckoutToleranceMinutes`
  - `allowHolidayAttendance`
  - `allowWeekendAttendance`
  - `autoAbsentEnabled`
  - `autoCheckoutEnabled`
  - `requiresSelfie`
  - `requiresLocation`
  - `isActive`
- Tambahkan migration dan update Prisma client.

### Prioritas 2 — Perluasan Model Attendance

- Tambahkan `branchId` ke tabel attendance.
- Tambahkan `method` ke tabel attendance.
- Tambahkan `policyId` atau minimal `policy snapshot` ke attendance.
- Tambahkan metadata lokasi:
  - `checkInLatitude`
  - `checkInLongitude`
  - `checkOutLatitude`
  - `checkOutLongitude`
  - `distanceMeters`
  - `isWithinRadius`
- Tambahkan metadata device/source:
  - `source`
  - `fingerprintDeviceId`
  - `mobileDeviceId`
- Tambahkan field exception:
  - `isException`
  - `exceptionType`
  - `exceptionReason`
  - `requiresReview`
- Tambahkan field hasil evaluasi kerja:
  - `scheduledWorkStart`
  - `scheduledWorkEnd`
  - `resolvedCalendarId`
  - `resolvedBranchId`

### Prioritas 3 — Engine Resolusi Konteks Attendance

- Buat service baru untuk resolve `attendance context` berdasarkan:
  - employee
  - tanggal
  - active assignment / secondment
  - resolved work calendar
  - resolved branch attendance policy
- Implementasikan urutan resolusi branch kerja:
  - assignment aktif pada tanggal attendance
  - branch permanen employee
  - fallback error jika tidak ada konteks branch yang valid
- Implementasikan snapshot resolver agar attendance menyimpan:
  - branch yang berlaku
  - kalender yang berlaku
  - rule policy yang berlaku
- Pastikan resolver reusable untuk:
  - check-in
  - check-out
  - koreksi attendance
  - job auto absent
  - reporting

### Prioritas 4 — Rule Hari Kerja dan Jam Kerja Berbasis Kalender Karyawan

- Ubah flow create attendance agar wajib resolve `employee day schedule` sebelum create record.
- Jika hari tersebut bukan working day:
  - tolak attendance jika policy tidak mengizinkan
  - atau tandai exception jika policy mengizinkan attendance off-day
- Hitung status attendance berdasarkan:
  - jadwal mulai kerja
  - toleransi telat
  - jadwal pulang
  - toleransi pulang cepat
- Pastikan support edge case:
  - shift malam
  - holiday attendance
  - weekend attendance
  - clock-out lintas hari
- Pastikan `lateMinutes` dan `earlyLeaveMinutes` tidak lagi sekadar field kosong, tetapi diisi dari hasil evaluasi rule.

### Prioritas 5 — Enforcement Metode Absensi Per Branch

- Enforce rule `FINGERPRINT only`.
- Enforce rule `MOBILE_GPS only`.
- Enforce rule `BOTH`.
- Enforce rule `MANUAL` hanya untuk HR/admin jika memang dibutuhkan.
- Tambahkan validasi request attendance agar input berbeda tergantung method:
  - fingerprint butuh device/source data
  - mobile GPS butuh latitude/longitude
  - manual butuh reason dan audit actor
- Pastikan check-out juga tunduk pada policy method jika dibutuhkan.

### Prioritas 6 — Geofencing Dinamis Per Branch

- Implementasikan kalkulasi jarak GPS terhadap titik policy branch.
- Simpan hasil jarak aktual ke attendance record.
- Implementasikan mode response saat di luar radius:
  - hard reject
  - accept with flag
  - accept with mandatory review
- Tambahkan toleransi accuracy GPS bila diperlukan.
- Tentukan perilaku jika branch tidak punya koordinat tapi method = `MOBILE_GPS`.
- Tambahkan pesan error yang jelas untuk mobile:
  - lokasi tidak tersedia
  - radius policy belum dikonfigurasi
  - user di luar radius

### Prioritas 7 — Fondasi Fingerprint Device

- Tambahkan model `FingerprintDevice`.
- Relasikan device ke branch.
- Simpan atribut minimum:
  - `deviceCode`
  - `deviceName`
  - `provider`
  - `serialNumber`
  - `ipAddress`
  - `isActive`
- Siapkan desain ingestion log fingerprint:
  - direct API push
  - polling/import batch
  - manual upload log
- Tambahkan mapping event fingerprint ke attendance context resolver.
- Pastikan fingerprint event tetap divalidasi terhadap kalender kerja karyawan pada tanggal event.

### Prioritas 8 — Exception, Review, dan Koreksi

- Tambahkan kategori exception:
  - `OUT_OF_RADIUS`
  - `OFF_DAY_ATTENDANCE`
  - `MISSING_POLICY`
  - `MISSING_GPS`
  - `METHOD_NOT_ALLOWED`
  - `DEVICE_NOT_REGISTERED`
- Tambahkan alur review untuk attendance exception.
- Bedakan koreksi manual biasa dengan exception review.
- Simpan actor dan alasan perubahan pada correction flow.
- Siapkan audit trail agar perubahan attendance bisa ditelusuri.

### Prioritas 9 — API Contract Attendance V2

- Revisi request create attendance agar method-aware.
- Tambahkan endpoint web untuk bootstrap attendance context:
  - get active attendance context
  - get resolved branch policy
  - get today schedule
- Tambahkan endpoint admin untuk CRUD branch attendance policy.
- Tambahkan endpoint admin untuk CRUD fingerprint device.
- Tambahkan endpoint review attendance exception.
- Pastikan response API mengembalikan:
  - branch aktif
  - calendar aktif
  - method yang diizinkan
  - radius yang berlaku
  - hasil evaluasi lokasi

### Prioritas 10 — UI / UX Admin dan Web Readiness

- Tambahkan halaman admin konfigurasi branch attendance policy.
- Tambahkan konfigurasi method attendance per branch.
- Tambahkan konfigurasi geofence radius per branch.
- Tambahkan konfigurasi fallback policy level company.
- Tambahkan tampilan exception queue untuk HR/admin.
- Siapkan alur web yang mengurangi ambiguity:
  - apakah user boleh absen sekarang
  - absen untuk branch mana
  - pakai method apa
  - dalam radius atau tidak
  - kapan record harus masuk exception review

### Prioritas 11 — Job Otomatis dan Konsistensi Operasional

- Tambahkan job auto absent berbasis resolved employee schedule.
- Tambahkan job auto checkout jika policy mengizinkan.
- Pastikan job otomatis juga branch-aware dan policy-aware.
- Pastikan job tidak membuat absence di hari non-working kecuali rule memang mengizinkan.
- Siapkan lock/cutoff agar payroll period tidak mudah berubah sembarangan.

### Prioritas 12 — Reporting dan Dampak ke Modul Lain

- Update report attendance agar bisa difilter per branch, method, dan exception status.
- Tambahkan kolom branch, method, within radius, dan review status pada report.
- Pastikan dampak ke payroll jelas:
  - late minutes
  - absence
  - holiday attendance
  - off-day attendance
- Pastikan dampak ke approval lembur dan koreksi attendance tidak konflik.

## Keputusan Produk Yang Perlu Dikunci Selama Implementasi

- Apakah branch tanpa policy boleh fallback ke company default atau harus hard error.
- Apakah `OUT_OF_RADIUS` langsung ditolak atau tetap disimpan untuk review.
- Apakah `MOBILE_GPS` wajib selfie.
- Apakah fingerprint branch boleh dipakai oleh employee secondment dari branch lain.
- Apakah attendance off-day otomatis dianggap lembur atau hanya attendance exception.
- Apakah manual attendance boleh melewati policy method branch.

## Urutan Eksekusi Yang Disarankan

### Fase 1 — Domain dan Schema

- Implement model policy dan perluasan attendance.
- Implement resolver konteks attendance.
- Tambahkan migration.

### Fase 2 — Enforcement Attendance

- Integrasikan resolver ke create/check-out attendance.
- Integrasikan rule kalender kerja karyawan.
- Integrasikan geofencing dan method enforcement.

### Fase 3 — Admin Configuration

- CRUD branch attendance policy.
- CRUD fingerprint device.
- Exception review queue.

### Fase 4 — Automation dan Reporting

- Auto absent.
- Auto checkout.
- Reporting dan audit trail.

### Fase 5 — Mobile Readiness

- Endpoint bootstrap untuk frontend web.
- Response contract branch-aware.
- Error contract yang jelas untuk geofence dan method mismatch.

## Acceptance Criteria Minimum

- Attendance resolve jadwal kerja dari kalender kerja karyawan, bukan hardcoded.
- Attendance resolve branch kerja aktif karyawan secara dinamis.
- Branch A dan Branch B bisa punya method attendance berbeda.
- Radius GPS bisa beda per branch dan enforced saat mobile check-in.
- Fingerprint branch bisa diregistrasi dan dipakai sebagai source attendance.
- Attendance hari libur dan hari non-kerja ditangani sesuai policy, bukan dianggap present biasa.
- Setiap attendance record menyimpan snapshot rule yang dipakai saat record dibuat.
- Admin bisa melihat exception queue dan alasan kenapa attendance flagged.

## Task Yang Bisa Mulai Dikerjakan Sekarang

- Tambahkan schema `BranchAttendancePolicy`.
- Tambahkan field attendance yang dibutuhkan untuk branch-aware tracking.
- Buat resolver `resolveAttendanceContext(employeeId, attendanceDate)`.
- Refactor `attendanceService.create()` agar memakai resolver tersebut.
- Buat desain request/response baru untuk web check-in GPS.
- Buat admin CRUD policy branch.

## Catatan Penting

- Implementasi ini harus tetap berpijak pada `kalender kerja karyawan` sebagai source of truth.
- Policy branch adalah layer dinamis untuk enforcement, geofence, method, dan exception.
- Sistem tidak boleh bergantung pada `employee.branchId` saat ini saja; harus mempertimbangkan assignment aktif pada tanggal attendance.
- Fokus delivery saat ini adalah `web`, bukan pengembangan aplikasi mobile.
