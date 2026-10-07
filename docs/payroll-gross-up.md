# Gross-up PPh 21 — perusahaan menanggung pajak karyawan

GAP-17. Satu-satunya gap yang masih benar-benar terbuka setelah pengukuran
ulang 1 Oktober 2026, dan yang terakhir ditutup.

## Masalahnya bukan penjumlahan

Metode gross-up biasa disalahpahami sebagai "tambahkan pajaknya ke gaji".
Kalau dikerjakan seperti itu, tunjangan pajak yang baru ditambahkan **itu
sendiri penghasilan kena pajak**, jadi pajaknya naik, jadi tunjangannya kurang,
dan karyawan tetap menanggung selisihnya. Yang benar adalah tunjangan `A` yang
membayar pajak yang ditimbulkannya sendiri:

```
A = pajak(bruto + A)
```

Di lapisan tarif progresif persamaan itu tidak punya bentuk tertutup, jadi
diselesaikan dengan **iterasi titik tetap** dari `A = 0`
(`grossUpTaxAllowance` di `backend/src/shared/payroll/pph21.ts`). Pemetaannya
kontraktif — satu rupiah tambahan tunjangan menaikkan pajak paling banyak
sebesar tarif marginal tertinggi setelah biaya jabatan (0,35 × 0,95 < 1) —
sehingga tiap langkah memotong selisih minimal dua per tiga dan beberapa
langkah saja sudah masuk ke dalam satu rupiah.

Nilai tunjangan dibaca kembali **dari angka pajak akhir**, bukan dari angka
yang dimasukkan ke dalamnya, supaya tunjangan dan potongan PPh 21 di slip gaji
adalah bilangan yang sama persis. Itu inti gross-up: take-home karyawan tidak
boleh bergerak saat pajaknya bergerak.

## Menyalakannya

| Setting | Default | Arti |
|---|---|---|
| `pph21_gross_up_enabled` | `false` | perusahaan menanggung PPh 21 karyawan |

**Mati secara default.** Menyalakannya menaikkan biaya pemberi kerja dan
mengubah setiap slip gaji — itu keputusan tenant, bukan efek samping deploy.
Sama seperti `benefit_payroll_deduction_enabled` dan
`unpaid_leave_deduction_enabled`.

```bash
curl -X PUT https://<host>/api/v1/company-settings/pph21_gross_up_enabled \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"value":"true"}'
```

Nilai hanya menerima `true`/`false` huruf kecil — `TRUE` ditolak di boundary,
karena setting yang gagal diam-diam adalah kegagalan yang paling mahal untuk
sakelar yang mengatur uang.

## Yang terjadi di payroll run

1. Run membaca setting, lalu memastikan komponen sistem `TAX_ALLOWANCE_AUTO`
   ada (`Tunjangan Pajak (Gross-Up)`, tipe `ALLOWANCE`, **taxable**, dibuat
   sekali per perusahaan).
2. `calculateEmployeePay` menyelesaikan iterasinya, menetapkan potongan
   `PPH21` sebesar pajak hasil akhir, dan menambahkan tunjangan sebesar angka
   yang sama sebagai penghasilan kena pajak.
3. `policySnapshot` run mencatat `grossUp: true`, jadi slip lama tetap bisa
   dijelaskan setelah settingnya diubah.

Slip gaji memperlihatkan **kedua sisinya** — tunjangan di penghasilan dan
potongan di deduksi. Keduanya sengaja tidak disaling-hapuskan: karyawan berhak
melihat berapa pajak yang dibayarkan atas namanya, dan angka itulah yang
muncul di bukti potong 1721-A1.

## Batasnya, yang disengaja

- **Tanpa komponen `PPH21` di alokasi gaji, tunjangan tidak diberikan.**
  Alokasi tanpa baris pajak tidak memotong pajak sama sekali, jadi menambahkan
  tunjangan saja bukan gross-up melainkan kenaikan gaji. Dijaga test.
- **Hanya pajak bulanan.** Rekonsiliasi Desember (GAP-16) menghitung ulang dari
  komponen slip, dan tunjangan pajak ikut terbaca sebagai penghasilan kena
  pajak di sana — konsisten, tetapi koreksi tahunannya sendiri belum
  di-gross-up. Perusahaan yang menanggung pajak biasanya juga ingin menanggung
  koreksinya; itu pekerjaan terpisah bila ada yang menagihnya.
- **Satu metode.** Varian "pajak ditanggung perusahaan tanpa di-gross-up"
  (non-deductible untuk PPh badan) tidak disediakan, karena yang diminta pasar
  adalah gross-up dan dua sakelar yang mirip hanya akan tertukar.

## Memverifikasi

```bash
cd backend && npx jest --config '{"preset":"ts-jest","testEnvironment":"node","moduleNameMapper":{"^@/(.*)$":"<rootDir>/src/$1"},"roots":["<rootDir>/src"],"testMatch":["**/*.test.ts"]}' src/shared/payroll/pph21-grossup.test.ts
```

Test yang membedakan: `pajak(bruto + A) == A` pada empat tingkat bruto yang
melintasi lapisan tarif, net pay persis sama dengan bruto kena pajak saat
gross-up hidup, dan tidak ada tunjangan saat alokasi tidak punya baris PPh 21.
