# Requisition (man power planning)

GAP-22. Keputusanmu: **bangun requisition-nya, dan biarkan satu setting per
perusahaan menentukan apakah lowongan wajib merujuknya.**

## Kenapa setting, bukan kewajiban untuk semua

Perusahaan yang anggaran headcount-nya dikendalikan terpusat mendapat kontrol
yang memang ia bayar. Perusahaan yang tidak punya kendali itu justru mendapat
satu langkah wajib untuk **setiap penggantian karyawan yang resign** — birokrasi
tanpa apa pun di belakangnya.

| Setting | Default |
|---|---|
| `recruitment_requisition_required` | `false` |

Requisition-nya sendiri **tetap ada** meski setting-nya mati, jadi perusahaan
bisa memakainya sebagai catatan niat lebih dulu, lalu menyalakan gerbangnya
ketika sudah siap.

## Alurnya

```bash
# 1. Kepala departemen mengajukan kebutuhan
curl -X POST https://<host>/api/v1/recruitment/requisitions \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "code":"REQ-2026-001","title":"Senior Engineer","headcount":2,
    "reason":"Penggantian dua engineer yang resign bulan lalu.",
    "departmentId":"<uuid>","budgetPerHire":20000000
  }'

# 2. Diajukan, lalu disetujui (atau ditolak dengan alasan)
curl -X PATCH .../requisitions/<id>/submit
curl -X PATCH .../requisitions/<id>/approve

# 3. Lowongan dibuka atas dasar itu
curl -X POST .../job-postings -d '{"...":"...","requisitionId":"<id>","vacancies":1}'
```

`reason` **wajib** dan minimal sepuluh karakter: "butuh orang" bukan keputusan
headcount yang bisa ditinjau siapa pun.

`GET /recruitment/requisitions` mengembalikan daftarnya **beserta** apakah
requisition sedang diwajibkan, supaya antarmuka tahu harus memaksa atau tidak
tanpa menebak.

## Yang dijaga saat lowongan dibuka

Sebuah foreign key saja tidak cukup. Yang diperiksa:

| Pemeriksaan | Tanpa itu |
|---|---|
| Requisition harus `APPROVED` | lowongan dibuka atas dasar permintaan yang belum disetujui siapa pun |
| Requisition harus milik perusahaan aktif | lowongan satu perusahaan memakai anggaran headcount perusahaan lain |
| Jumlah vacancy tidak boleh melewati headcount yang disetujui | **persetujuan menjadi formalitas**: sejumlah lowongan berapa pun bisa dibuka atas satu kepala yang disetujui |
| Wajib-tidaknya requisition dari setting | perusahaan tanpa anggaran terpusat ikut terhambat |

Begitu seluruh headcount-nya terpakai, requisition-nya otomatis menjadi
`FULFILLED` dan tidak lagi muncul sebagai tersedia.

**Maker-checker:** pengaju tidak bisa menyetujui requisition-nya sendiri.
Headcount adalah anggaran, dan orang yang meminta kepala tidak memberikannya
kepada dirinya sendiri.

Setiap transisi status memakai update bersyarat, jadi dua penyetuju yang menekan
bersamaan tidak bisa dua-duanya berhasil pada satu keputusan anggaran.

## Verifikasi

33 test: gerbang setting (termasuk nilai yang bukan `'true'`), requisition
disetujui/belum/perusahaan lain, batas headcount terhadap lowongan yang sudah
dibuka, penandaan `FULFILLED`, validasi pembuatan (headcount, departemen milik
perusahaan lain, kode ganda), maker-checker, transisi yang diserobot orang lain,
dan pembatalan.
