# Rapel — membayar periode yang sudah ditutup

Keputusan organisasi (GAP-14, 30 September 2026): **periode yang sudah ditutup
tidak dibuka kembali.** Karyawan yang terlewat pada periode itu dibayar lewat
komponen **rapel** pada run periode berikutnya.

Alasannya bukan kemudahan teknis. Membuka kembali periode tertutup mengubah
angka laporan yang sudah dikirim dan rekonsiliasi bank yang sudah beres; rapel
memberi jejak yang sama jelasnya tanpa menyentuh apa pun yang sudah keluar.

## Alurnya

1. HR mendaftarkan rapel untuk satu karyawan pada satu periode tertutup:

```bash
curl -X POST https://<host>/api/v1/payroll/arrears \
  -H "Authorization: Bearer $HR_TOKEN" -H "Content-Type: application/json" \
  -d '{"employeeId":"<uuid>","sourcePeriodId":"<uuid periode tertutup>","notes":"terlewat, masuk 21 Agustus"}'
```

2. Run periode berikutnya mengambilnya sendiri — tidak ada langkah manual lagi.
   Di slip muncul sebagai komponen `Rapel <kode periode>`, terpisah dari gaji
   bulan itu, sehingga karyawan bisa melihat kenapa bulan ini lebih besar.
3. Baris rapel berubah menjadi `APPLIED` dengan `payslipId` dan `appliedRunId`
   yang menunjuk slip tempat ia dibayar.

`GET /api/v1/payroll/arrears?status=PENDING` melihat yang belum terbayar;
`DELETE /api/v1/payroll/arrears/:id` membatalkan yang masih `PENDING`.

## Nominalnya dihitung, bukan diketik

**Tidak ada field jumlah di API.** Mengetik nominal uang dengan tangan adalah
cara termudah sebuah angka salah sampai ke berkas transfer bank. Server
menurunkannya dari:

- **gaji yang berlaku pada periode itu** — aturan as-of yang sama dengan run:
  baris gaji terakhir yang efektif pada atau sebelum akhir periode;
- **tunjangan aktif** pada baris gaji itu (komponen `ALLOWANCE`). Komponen
  potongan tidak ikut, karena yang disimpan adalah **bruto**;
- **prorata hari kerja yang benar-benar dijalani**: karyawan yang masuk tanggal
  21 mendapat 11 dari 31 hari — dan justru karyawan yang masuk di tengah bulan
  inilah yang paling sering terlewat dari daftar payroll;
- **batas tanggal terakhir bekerja** bila ada resignasi yang sudah disetujui.
  Tanpa batas ini, orang yang berhenti tanggal 10 lalu terlewat akan menerima
  satu bulan penuh — uang nyata, sekali keluar sulit ditarik kembali.

Cara angka itu diperoleh disimpan di kolom `basis` (gaji, komponen, jumlah hari,
tanggal masuk/terakhir bekerja), jadi nominal bisa ditelusuri tanpa menghitung
ulang. Kalau derivasinya salah, baris dibatalkan lalu didaftarkan ulang —
tidak diedit.

## Pajak: dikenakan pada periode yang membayarnya

Yang disimpan adalah **bruto**, dan rapel masuk sebagai penghasilan bruto pada
slip periode pembayaran. PPh21, BPJS, dan seluruh perhitungan pada jalur itu
memperlakukannya seperti penghasilan bulan tersebut — sesuai praktik PPh21 di
Indonesia, dan alasan kenapa pajak **tidak** dihitung saat rapel didaftarkan.

Konsekuensi yang perlu diketahui: pajak rapel mengikuti tarif bulan pembayaran,
bukan bulan asalnya. Untuk metode annualized net yang dipakai di sini,
selisihnya kecil dan akan bertemu kembali pada rekonsiliasi akhir tahun bila
GAP-16 kelak diputuskan.

## Pagar terhadap pembayaran ganda

Ini fitur yang menggerakkan uang, jadi pagarnya berlapis:

| Pagar | Yang dicegah |
|---|---|
| `@@unique([employeeId, sourcePeriodId])` | dua baris rapel untuk periode yang sama, apa pun statusnya |
| Cek payslip pada periode sumber | rapel untuk orang yang **sudah** dibayar di periode itu (nominal salah adalah koreksi, bukan rapel) |
| Periode harus `CLOSED` | rapel pada periode terbuka yang run-nya masih bisa memasukkan karyawan itu |
| Klaim `updateMany` bersyarat `PENDING` | run kedua membayar baris yang sudah diambil run lain — hitungannya tidak 1, seluruh run gagal |
| Pembatalan bersyarat `PENDING` | membatalkan baris yang baru saja diklaim run, yang akan menyembunyikan uang yang sudah dibayar |
| Komponen `isProrated: false` | prorata ganda — nominalnya sudah diprorata untuk periode asalnya |

Diverifikasi pada MySQL sungguhan (`payroll-calculation.mysql.test.ts`): rapel
dibayar **sekali**, namanya menyebut periode asal, statusnya menjadi `APPLIED`
dengan slip dan run yang menunjuknya, dan run periode berikutnya **tidak**
membayarnya lagi. Ditambah 16 test unit untuk perhitungan dan setiap pagar di
atas.
