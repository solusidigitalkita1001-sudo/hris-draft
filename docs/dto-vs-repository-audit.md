# Field yang diterima DTO tapi tidak pernah ditulis repository

Audit ini lahir dari satu bug yang ketemu tanpa dicari: `isFixedAllowance`
diterima `createSalaryComponentSchema` — lengkap dengan komentar yang
menjelaskan maksudnya — tapi `createSalaryComponent` dan `updateSalaryComponent`
tidak memetakannya, jadi nilainya selalu `false`. Kolom itu menyusun "upah
sebulan", basis THR (Permenaker 6/2016), sehingga THR dibayar dari basis yang
lebih kecil tanpa error apa pun.

Pertanyaan yang wajar sesudahnya: **di mana lagi?**

## Caranya

`backend/scripts/dto-vs-repository-audit.py`. Untuk setiap method yang menerima
`Create*DTO`/`Update*DTO`, bandingkan field top-level schema zod-nya dengan nama
yang muncul di body method itu. Field yang **tidak muncul sama sekali** dilaporkan.

Dua penyaring:

- method yang meneruskan `data`/`dto` utuh (spread, `{ data }`, atau sebagai
  argumen ke pemanggil lain) dilewati — di sana tidak ada field yang bisa hilang
- `companyId` diabaikan, karena sering datang dari konteks permintaan

Heuristiknya sengaja meleset ke arah **lapor-lebih**: lebih baik enam kandidat
yang harus ditriase tangan daripada satu `isFixedAllowance` yang lolos lagi.

## Hasilnya: satu temuan nyata

**`PayrollRun.notes`.** `createPayrollRunSchema` menerima `notes`, model
`PayrollRun` punya kolomnya, dan `payrollRepository.createPayrollRun` tidak
pernah menulisnya. Catatan kenapa sebuah payroll run dibuat — "run koreksi untuk
rapel Mei" — hilang tanpa suara, dan tidak ada endpoint lain yang bisa
mengisinya belakangan, jadi kolom itu praktis mati.

Dampaknya bukan uang seperti `isFixedAllowance`, tapi jejak: payroll run adalah
tempat orang mencari alasan sebuah pembayaran terjadi. Diperbaiki.

## Enam kandidat lain, dan kenapa semuanya bukan bug

| Lokasi | Kenapa aman |
|---|---|
| `asset.repository.ts:update` | `prisma.asset.update({ where: { id }, data })` — `data` diteruskan utuh, lolos saringan hanya karena spasi sebelum `})` |
| `onboarding.repository.ts:createClearance` | `prisma.exitClearance.create({ data, include: … })` — diteruskan utuh |
| `performance.repository.ts:createMethod` | `prisma.performanceMethod.create({ data })` — diteruskan utuh |
| `daily-activity.controller.ts:createRequest` / `updateRequest` | controller meneruskan `req.body` ke service; DTO-nya hanya tipe generik `Request<…>` |
| `ewa.controller.ts:createRequest` | sama, plus dua penolakan eksplisit untuk field yang tidak boleh dikirim klien |

Saringan pass-through bisa dipertajam untuk menangkap `data })`, tapi dibiarkan
apa adanya: enam baris yang jelas-jelas aman lebih murah daripada saringan yang
terlalu pintar dan diam-diam menelan temuan betulan.

## Kesimpulan

Pola `isFixedAllowance` **tidak** menyebar. Dari seluruh modul — payroll,
employee, benefit, leave, performance, recruitment, training, travel-expense,
onboarding, EWA, daily-activity, asset, organization, work-calendar — hanya satu
field lain yang benar-benar hilang di jalur tulis, dan itu kolom catatan, bukan
kolom uang.

Yang perlu dipegang dari sini: **repository yang memetakan field satu per satu
adalah tempat field bisa hilang; yang meneruskan `data` utuh tidak.** Tiga
repository yang pernah kehilangan field (`salary_components` dua kali,
`payroll_runs` sekali) semuanya bertipe pemetaan manual. Kalau nanti ada kolom
baru ditambahkan ke salah satunya, jalankan ulang skrip itu.
