# Laporan iuran BPJS bulanan

GAP-33 sebagian. Pembagiannya sama dengan rekap PPh21 tahunan: **angkanya sudah
ada**, **berkas unggah resminya menunggu satu contoh darimu**.

## Kenapa ini bukan sekadar menjumlahkan potongan di slip gaji

Slip gaji hanya mencatat apa yang **dipotong dari karyawan**. Iuran perusahaan —
JKK, JKM, dan bagian pemberi kerja untuk JHT, JP, dan JKN — **tidak pernah
muncul di slip**, padahal itulah sebagian besar yang harus disetor ke BPJS.

Karena itu laporan ini menghitung **kedua sisi** dari upah dasar dan kebijakan
perusahaan yang sama dengan yang dipakai run payroll. Efek sampingnya penting:
angka sisi karyawan di laporan ini **rekonsiliasi dengan slip gaji**, bukan
menyimpang darinya.

```bash
# JSON
curl -H "Authorization: Bearer $HR_TOKEN" \
  "https://<host>/api/v1/payroll/bpjs-report?periodId=<uuid periode>"

# CSV untuk rekonsiliasi tim payroll
curl -H "Authorization: Bearer $HR_TOKEN" \
  "https://<host>/api/v1/payroll/bpjs-report?periodId=<uuid periode>&format=csv"
```

## Isinya

Per karyawan: nomor karyawan, nama, NIK, nomor BPJS Kesehatan dan
Ketenagakerjaan, upah dasar, lalu:

| Sisi | Komponen |
|---|---|
| Karyawan | JHT 2%, JP 1% (dibatasi cap upah), JKN 1% (cap 12 juta) |
| Perusahaan | JKK 0,24%–1,74% menurut kelas risiko, JKM 0,30%, JHT 3,7%, JP 2% (cap), JKN 4% (cap) |

**Cap upah ditegakkan** — inilah bagian yang salah kalau seseorang menghitung
persentase lurus untuk karyawan bergaji tinggi: JHT dihitung dari upah penuh,
tetapi JP dibatasi cap JP dan JKN dibatasi 12 juta.

Respons juga memuat **tarif dan cap efektif** yang dipakai (default digabung
dengan override perusahaan). Tanpa itu, setoran tahun lalu tidak bisa
diturunkan ulang setahun kemudian ketika tarifnya sudah berubah.

Hanya run yang **disetujui** yang dihitung.

### Peringatan

| Kode | Arti |
|---|---|
| `bpjs:KESEHATAN_NUMBER_MISSING` | nomor kepesertaan BPJS Kesehatan kosong |
| `bpjs:KETENAGAKERJAAN_NUMBER_MISSING` | nomor kepesertaan BPJS Ketenagakerjaan kosong |
| `employee:NIK_MISSING` | NIK kosong |
| `bpjs:<n>_EMPLOYEES_WITH_MISSING_IDENTIFIERS` | ringkasan di tingkat laporan |
| `payroll:NO_APPROVED_PAYSLIPS_IN_PERIOD` | periode itu tidak punya slip disetujui |

Iuran tanpa nomor kepesertaan tidak bisa dicocokkan ke peserta di sisi BPJS,
jadi pelaporan untuk orang itu gagal. Lebih baik terlihat di sini daripada di
loket.

## Yang menunggu satu berkas darimu

Berkas unggah resmi. Format mutasi bulanan BPJS Kesehatan dan BPJS
Ketenagakerjaan **berbeda satu sama lain** dan sudah berubah dari waktu ke
waktu; tata letak yang ditebak ditolak di loket — dan itu titik termahal untuk
mengetahuinya.

Kirim satu contoh berkas yang tim payroll-mu benar-benar unggah setiap bulan
(salah satu atau keduanya), dan generatornya dilapiskan di atas data yang sudah
ada ini.

## Akses

`payroll:read` plus `requireCompanyPayrollAccess`, `Cache-Control: no-store`,
dan pembacaannya dicatat di audit trail (`VIEW_BPJS_REPORT`) — satu respons
memuat upah seluruh karyawan pada satu periode.

## Verifikasi

13 test: kedua sisi pada tarif standar, penegakan cap JP dan JKN untuk gaji di
atas cap, tarif dari kebijakan perusahaan (kelas risiko tertinggi), penjumlahan
antar karyawan, filter run disetujui, setiap peringatan di atas, penolakan
periode di luar perusahaan aktif, penerbitan tarif efektif, serta bentuk CSV
termasuk nama yang memuat koma.
