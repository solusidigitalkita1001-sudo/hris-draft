# Onboarding perusahaan baru — kesiapan jual

Dokumen ini lahir dari satu pertanyaan: kalau produk ini dijual ke perusahaan
berikutnya, apa yang harus dikerjakan tangan? Jawabannya ternyata: **hampir
semuanya**, dan dua di antaranya tidak bisa dikerjakan sama sekali.

## Temuan 1 — perusahaan kedua tidak bisa punya cuti `ANNUAL`

`LeaveType.code` dan `BenefitPlan.code` **unique di seluruh instalasi**, bukan
per perusahaan:

```prisma
model LeaveType {
  companyId String
  code      String @unique   // <- global
}
```

Justru dua tabel itulah yang isinya kode standar — `ANNUAL`, `SICK`, `UNPAID`,
`BPJS-KES`, `BPJS-TK`. Jadi perusahaan pertama yang mengklaim `ANNUAL`
mengklaimnya untuk semua orang, dan pelanggan kedua gagal tepat di katalog
cutinya sendiri. Seed-nya sendiri membuktikan hal ini: ia melakukan
`upsert({ where: { code } })` tanpa `companyId`, jadi memang hanya pernah bisa
benar untuk satu perusahaan.

Kenapa tidak pernah terasa: **setiap kode company-scoped yang lain dibuat
sistem** lewat `generateSystemCode`, yang menempelkan tanggal dan empat digit
acak (`CMP-ACME-261002-A3F1`), sehingga tabrakan antar-tenant tidak mungkin
terjadi di sana.

Perbaikannya: migrasi `20261002100000_tenant_scoped_leave_and_benefit_codes`
menurunkan indeks unique global menjadi `@@unique([companyId, code])`.
Melonggarkan unique tidak bisa gagal pada data yang ada — kalau `(code)` unik
maka `(company_id, code)` otomatis unik juga.

## Temuan 2 — perusahaan baru lahir tidak bisa dipakai

`companyService.create` membuat company + satu cabang "Kantor Pusat" +
attendance policy. Setelah itu, selesai. Yang tidak ada:

| Yang hilang | Akibatnya |
|---|---|
| Jenis cuti | tidak ada karyawan yang bisa mengajukan cuti |
| Komponen gaji | **payroll tidak bisa dihitung sama sekali** |

Yang kedua lebih tajam dari kelihatannya. Mesin payroll mengenali empat kode
secara harfiah — `GP`, `BPJS-KES`, `BPJS-TK`, `PPH21` — dan alokasi gaji tanpa
baris `PPH21` **tidak memotong pajak apa pun**, tanpa error. Itu juga yang
membuat setting gross-up (`pph21_gross_up_enabled`) diam-diam tidak melakukan
apa-apa.

Perbaikannya: `bootstrapCompany` di
`backend/src/modules/organization/services/company-bootstrap.service.ts`,
dipanggil otomatis saat company dibuat.

```bash
# Untuk perusahaan yang sudah ada (atau setup yang terputus di tengah):
curl -X POST https://<host>/api/v1/organization/companies/<id>/bootstrap \
  -H "Authorization: Bearer $TOKEN"
# -> { leaveTypesCreated, leaveTypesExisting, salaryComponentsCreated, ... }
```

**Idempoten.** Aman dijalankan ulang, dan **tidak pernah menimpa** apa yang
sudah dikonfigurasi tenant — jenis cuti yang sudah diganti namanya tetap
seperti itu. Yang dikerjakan hanya mengisi yang belum ada.

### Yang sengaja TIDAK di-seed

**Tunjangan makan / transport.** Nominalnya kebijakan tenant. Menanam angka
perusahaan lain sebagai default berarti ada angka yang tidak dipilih siapa pun
ikut terpakai ke dalam gaji orang.

**Template approval workflow.** Ini yang paling penting untuk tidak dilakukan.
Template yang stage-nya menunjuk role tanpa anggota di perusahaan itu akan
resolve ke "tidak ada approver", dan engine menolak stage semacam itu — jadi
template yang "sudah disiapkan baik-baik" justru membuat **setiap pengajuan
cuti gagal**. Tanpa template, domainnya jatuh ke direct-approve, yang jalan.
Menyusun template adalah langkah setup HR yang disengaja, bukan default.

## Yang masih dikerjakan tangan saat onboarding

Jujur, supaya tidak ada yang menyangka dokumen ini sudah menutup semuanya:

- **Kalender kerja & hari libur nasional** per tahun — ada endpoint generate-nya
  (`/work-calendars`), tetapi belum dirangkai ke pembuatan company, dan daftar
  libur tiap tahun memang menunggu SKB pemerintah.
- **Nomor karyawan tidak bisa dibawa pelanggan.** `employeeNumber` selalu
  di-generate (`EMP-JOHN-261002-A3F1`); nilai yang dikirim klien diabaikan
  tanpa pemberitahuan, dan kolomnya unique global. Perusahaan yang pindah dari
  payroll lain tidak bisa mempertahankan penomorannya. Ini objection hari
  pertama di setiap demo HRIS, dan belum diperbaiki.
- **Tabel referensi pajak & BPJS** bersifat global (`companyId: null`) dengan
  fallback konstanta di kode, jadi tenant baru langsung benar — kecuali kalau
  dia perlu tarif sendiri.

## Memverifikasi

```bash
cd backend && npx jest --config '{"preset":"ts-jest","testEnvironment":"node","moduleNameMapper":{"^@/(.*)$":"<rootDir>/src/$1"},"roots":["<rootDir>/src"],"testMatch":["**/*.test.ts"]}' src/modules/organization/services/company-bootstrap.test.ts
```

Uji yang benar-benar bisa gagal: `PPH21` ada di komponen yang dibuat (tanpa itu
pajak tidak dipotong sama sekali), dijalankan dua kali tidak menambah baris dan
tidak menimpa nama yang diganti tenant, dan perusahaan kedua tetap mendapat
`ANNUAL` sendiri meski perusahaan lain sudah punya — yang terakhir ini akan
gagal pada skema sebelum migrasi di atas.
