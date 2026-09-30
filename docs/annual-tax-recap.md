# Rekap PPh21 tahunan (bahan bukti potong 1721-A1)

GAP-32 sebagian. Dokumen ini menjelaskan apa yang **sudah ada** dan apa yang
**masih menunggu satu berkas darimu** — dan kenapa pembagiannya begitu.

## Yang sudah ada: angkanya

Per karyawan per tahun, dirakit dari slip gaji pada run yang **sudah
disetujui**:

```bash
# JSON
curl -H "Authorization: Bearer $HR_TOKEN" \
  "https://<host>/api/v1/payroll/annual-tax-recap/<employeeId>?year=2026"

# CSV untuk rekonsiliasi tim pajak
curl -H "Authorization: Bearer $HR_TOKEN" \
  "https://<host>/api/v1/payroll/annual-tax-recap/<employeeId>?year=2026&format=csv"

# Satu baris per karyawan untuk seluruh perusahaan
curl -H "Authorization: Bearer $HR_TOKEN" \
  "https://<host>/api/v1/payroll/annual-tax-recap?year=2026"
```

Isinya: penghasilan bruto per bulan, PPh21 yang dipotong per bulan, iuran BPJS
bagian karyawan, take-home, beserta totalnya — ditambah identitas yang diminta
formulir (NPWP karyawan dan perusahaan, status PTKP, tanggal masuk).

**Status PTKP** diturunkan dari status pernikahan dan jumlah tanggungan dengan
notasi yang biasa dipakai (`K/2`, `TK/0`). Tanggungan dibatasi tiga, sesuai
aturan PTKP — dan kalau karyawan punya lebih, rekapnya **mengatakan** bahwa
pembatasan itu terjadi, bukan diam-diam memotongnya.

**Hanya run yang disetujui yang dihitung.** Draft atau run yang ditolak bukan
uang yang pernah diterima siapa pun; memasukkannya akan melebih-lebihkan baik
penghasilan yang dilaporkan maupun pajak yang dipotong.

### Peringatan yang perlu dibaca sebelum melapor

Rekap tidak hanya memberi angka, ia juga menandai hal yang membuat angka itu
salah bila dibaca sebagai final:

| Kode | Arti |
|---|---|
| `employee:NPWP_MISSING` | karyawan tanpa NPWP — tarif potongannya lebih tinggi dan formulirnya butuh nomor itu |
| `company:NPWP_MISSING` | NPWP pemotong belum diisi |
| `payroll:NO_APPROVED_PAYSLIPS_IN_YEAR` | tidak ada slip disetujui pada tahun itu; nol di sini bukan "pajaknya nol" |
| `payroll:PARTIAL_YEAR_<n>_MONTHS` | rekap mencakup sebagian tahun (karyawan masuk/keluar di tengah tahun — normal, tapi harus diketahui) |
| `tax:DEPENDENTS_CAPPED_AT_3_OF_<n>` | tanggungan melebihi batas PTKP |

## Yang menunggu satu berkas darimu: formulirnya

Yang **belum** dibuat adalah berkas resmi 1721-A1 dalam format DJP.

Alasannya bukan kemalasan. Tata letak dan skema berkas formulir itu sudah
berubah lebih dari sekali, dan menebak tata letaknya menghasilkan dokumen yang
**ditolak kantor pajak** — yaitu kegagalan yang baru diketahui pada saat paling
mahal. Detail formatlah yang menentukan diterima atau tidak, dan detail itu
hanya bisa datang dari contoh asli yang benar-benar kamu pakai tahun ini.

Yang dibangun sekarang justru bagian yang mahal untuk dibuat benar dan
**tidak** bergantung format: perakitan dan penjumlahan angkanya, beserta
pemeriksaan kewarasannya. Begitu kamu mengirim satu contoh 1721-A1, formulirnya
tinggal dilapiskan di atas data ini.

## Akses

Butuh permission `payroll:read` **dan** melewati `requireCompanyPayrollAccess`,
sama seperti run dan slip gaji. Alasannya: satu respons di sini memuat
penghasilan satu orang selama setahun. Karena itu juga `Cache-Control:
no-store`, dan pembacaan per karyawan dicatat di audit trail
(`VIEW_ANNUAL_TAX_RECAP`).

## Verifikasi

18 test: penjumlahan setahun, urutan bulan yang tidak bergantung urutan data,
filter run disetujui, penurunan status PTKP untuk lima kombinasi, setiap
peringatan di tabel di atas, penolakan karyawan di luar perusahaan aktif, batas
tahun, dan bentuk CSV beserta baris totalnya.
