# Bukti potong PPh 21 & bahan e-Bupot (GAP-32/33)

Sumber bentuk: **Lampiran I PER-2/PJ/2024** (berkas resmi
`Lampiran_PER02PJ2024.pdf`, diverifikasi baris-per-baris 12 Okt 2026).

| Formulir | Untuk | Endpoint |
|---|---|---|
| 1721-A1 (`1.1`) | masa pajak TERAKHIR pegawai tetap (Desember / berhenti) | `GET /payroll/bukti-potong-1721-a1/:employeeId?year=` |
| 1721-VIII (`1.5`) | tiap masa pajak SELAIN terakhir, per bulan | `GET /payroll/bukti-potong-1721-viii?periodId=&employeeId=&format=json\|csv` |
| 1721-VII (`1.4`) | PPh 21 FINAL — pesangon sekaligus (21-401-01) | `GET /payroll/bukti-potong-1721-vii/:severancePaymentId` |

Semua di balik `payroll:read` + company payroll access + audit view, seperti
rekap tahunan.

Yang perlu dipahami pemakainya:

- **Keluaran adalah DATA formulir**, untuk dimasukkan/diimpor ke aplikasi
  e-Bupot 21/26 DJP — bukan berkas impor aplikasi itu (formatnya artefak
  aplikasi, bukan bagian PER-2/PJ/2024). CSV-nya untuk rekonsiliasi tim pajak.
- **Nomor bukti potong** diterbitkan e-Bupot; `formatBuktiPotongNumberFor`
  tersedia bagi tenant yang menatausahakan nomor sendiri (`1.x-mm.yy-xxxxxxx`,
  urut setahun pajak).
- **Definisi bruto/PPh 1721-VIII = rekap tahunan** (`taxableOf`/`withheldOf`),
  jadi VIII, A1, dan rekonsiliasi Desember tidak bisa berselisih. Tarif
  kolom (5) diturunkan dari angka BEKU payslip (PPh ÷ DPP) — tarif yang
  benar-benar diterapkan.
- **1721-VII pesangon** memakai angka beku `SeverancePayment` (APPLIED saja);
  tarif tertingginya dari bruto KUMULATIF pemutusan yang sama (PP 68/2009
  pasal 2 ayat (2)).
- **NIK belum dimodelkan** pada Employee: baris tanpa NPWP ditandai
  `tanpaNpwp` dan NIK diisi manusia di e-Bupot.
- `verified: false` pada semua builder sampai keluaran dibandingkan dengan
  formulir yang benar-benar DITERIMA kantor pajak.
