# Integrasi mesin absensi (punch device)

Dokumen ini untuk orang yang menyambungkan mesin fingerprint — atau middleware
di depannya — ke HRIS. Netral vendor: tidak ada SDK merek tertentu, mesin (atau
program kecil di sebelahnya) cukup bisa melakukan HTTP POST.

## Kenapa ini ada

Sebelum ini, `FINGERPRINT` adalah nilai yang **dinyatakan klien**. Tidak ada
perangkat, tidak ada kredensial mesin, tidak ada impor punch — siapa pun yang
bisa memanggil API absensi biasa bisa mengaku absen lewat fingerprint. Padahal
dua metode lain pada kebijakan yang sama diverifikasi server:

| Metode | Yang memverifikasi |
|---|---|
| `FACE_RECOGNITION` | server: deteksi wajah, ekstraksi descriptor, pencocokan di server |
| `MOBILE_GPS` | server: geofence cabang + deteksi mock location |
| `FINGERPRINT` **lewat perangkat terdaftar** | kredensial perangkat + ledger punch (dokumen ini) |
| `FINGERPRINT` **dinyatakan klien** | tidak ada — record diberi tanda `method:FINGERPRINT_NOT_DEVICE_ATTESTED` |

Jalur klien **tetap diterima**, karena cabang yang berkebijakan fingerprint dan
belum punya mesin tidak punya cara lain untuk absen. Bedanya sekarang: record
menyatakan apa adanya, dan punch dari mesin terdaftar tidak lagi memikul tanda
itu.

## Mendaftarkan mesin

HR (permission `attendance:create`) mendaftarkan satu baris per mesin:

```bash
curl -X POST https://<host>/api/v1/attendance-devices \
  -H "Authorization: Bearer $HR_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Terminal Lobi","serialNumber":"ZK-0001","branchId":"<uuid cabang>"}'
```

Responsnya memuat `token` — **satu-satunya kali token itu muncul**. Yang
disimpan server hanyalah SHA-256-nya, jadi dump database maupun admin yang
membaca tabel tidak bisa menyamar sebagai mesin. Kalau token hilang: matikan
perangkat lama (`PATCH .../:id` dengan `{"isActive": false}`) lalu daftarkan
ulang.

`serialNumber` unik per perusahaan, supaya dua terminal tidak tertukar di
ledger punch.

## Mengirim punch

```bash
curl -X POST https://<host>/api/v1/attendance-devices/punches \
  -H "Authorization: Device <token>" -H "Content-Type: application/json" \
  -d '{
    "punches": [
      {"employeeCode":"EMP001","externalId":"1042","punchedAt":"2026-09-30T01:02:03.000Z","direction":"AUTO"}
    ]
  }'
```

| Field | Arti |
|---|---|
| `employeeCode` | identitas karyawan sebagaimana terdaftar di mesin; dicocokkan ke `Employee.employeeNumber` **di perusahaan milik perangkat itu** |
| `externalId` | id punch milik mesin sendiri (nomor record/urutan). Unik per perangkat |
| `punchedAt` | waktu punch, ISO-8601 dengan zona waktu |
| `direction` | `AUTO` (default), `IN`, atau `OUT` |

Maksimal **500 punch per request**; backlog yang lebih panjang dikirim beberapa
kali.

### `AUTO` cukup untuk mesin yang tidak punya tombol in/out

`AUTO` membaca keadaan karyawan hari itu: belum ada record → dibuka (check-in),
sudah ada record yang terbuka → ditutup (check-out). Mesin yang memang tahu
arahnya boleh mengirim `IN`/`OUT`, dan server tidak menebak ulang.

### Mengirim ulang itu aman

`externalId` unik per perangkat. Mesin yang kehilangan koneksi lalu mengirim
seluruh backlog-nya akan mendapat status `DUPLICATE` untuk punch yang sudah
masuk — bukan absensi ganda. Karena itu **mesin sebaiknya mengirim ulang sampai
mendapat balasan**, bukan menghapus punch setelah satu percobaan.

## Membaca balasan

Respons selalu 200 selama kredensial perangkat sah, dengan laporan per punch:

```json
{
  "success": true,
  "data": {
    "received": 3, "applied": 1, "duplicate": 1, "unmatched": 0, "rejected": 1,
    "outcomes": [
      {"externalId":"1042","employeeCode":"EMP001","status":"APPLIED","attendanceId":"..."},
      {"externalId":"1041","employeeCode":"EMP001","status":"DUPLICATE","reason":"Already received (recorded as APPLIED)"},
      {"externalId":"1043","employeeCode":"EMP009","status":"REJECTED","reason":"Payroll period is closed for this date"}
    ]
  }
}
```

**Satu punch yang gagal tidak menggugurkan batch.** Mesin yang tersambung
kembali setelah seminggu mengirim ratusan punch; kalau satu punch jatuh pada
periode payroll yang sudah ditutup lalu seluruh request ditolak, sisanya hilang.
Karena itu setiap punch memikul hasilnya sendiri.

| Status | Arti | Yang harus dilakukan mesin |
|---|---|---|
| `APPLIED` | membuka atau menutup absensi | tandai terkirim |
| `DUPLICATE` | sudah pernah diterima | tandai terkirim |
| `UNMATCHED_EMPLOYEE` | tidak ada karyawan dengan kode itu di perusahaan perangkat | tandai terkirim; HR memperbaiki datanya |
| `REJECTED` | ada aturan yang menolak (periode payroll tertutup, metode tidak diizinkan kebijakan cabang, hari non-kerja, absensi sudah ditutup) | tandai terkirim; alasannya ada di `reason` |

Status HTTP selain 200 berarti masalah transport atau kredensial: **401** token
perangkat salah/tidak ada atau perangkat dimatikan, **422** payload tidak lolos
validasi. Untuk keduanya, punch belum tersimpan — kirim ulang setelah
diperbaiki.

## Ledger punch

Setiap punch disimpan **apa adanya sebelum** absensi diturunkan darinya,
termasuk punch yang tidak cocok dengan karyawan mana pun. Tanpa itu, "punch saya
tidak muncul" tidak punya bukti untuk diperiksa.

```bash
curl -H "Authorization: Bearer $HR_TOKEN" \
  "https://<host>/api/v1/attendance-devices/<deviceId>/punches?status=UNMATCHED_EMPLOYEE&limit=50"
```

## Batas keamanan yang perlu diketahui

- **Kredensial perangkat bukan sesi.** Token perangkat hanya berlaku di
  `POST /attendance-devices/punches`; endpoint HR menolaknya. Sebaliknya, sesi
  pengguna tidak bisa dipakai untuk mengirim punch. Keduanya diuji di
  `attendance-device.routes.test.ts`.
- **Satu perangkat terkurung di satu perusahaan.** Jalur punch berjalan di
  system context (tidak ada sesi pengguna), jadi middleware tenant tidak yang
  memfilter — filter `companyId` eksplisit pada pencarian karyawanlah yang
  mengurung. Kode karyawan yang sama di perusahaan lain akan jatuh sebagai
  `UNMATCHED_EMPLOYEE`, dan itu diuji khusus.
- **Perangkat tidak bisa mengarang karyawan, tanggal, atau kelonggaran.** Yang
  dikirim hanya siapa, kapan, dan id punch. Kebijakan cabang, keterlambatan,
  hari kerja, dan guard periode payroll tetap diputuskan server — jalur punch
  memakai layanan absensi yang sama dengan jalur HR.
- **Mesin sebaiknya dipasang di jaringan yang terkendali** dan bicara lewat
  HTTPS. Token perangkat statis: yang melindungi dari replay adalah
  `externalId` yang unik, bukan tanda tangan per-request. Kalau kelak dibutuhkan
  tanda tangan HMAC per request, tempatnya di middleware perangkat dan bentuk
  payload-nya tidak perlu berubah.
