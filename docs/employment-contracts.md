# Kontrak kerja: PKWT, PKWTT, dan probasi

GAP-19/20. Keputusanmu: **tabel `EmploymentContract`** dengan riwayat
perpanjangan utuh, bukan dua kolom tanggal di data karyawan, plus pengingat
30/14/7 hari ke HR dan atasan langsung.

## Kenapa tabel, bukan dua kolom tanggal

Karena PKWT punya **batas hukum pada total masa kerja berkontrak**. Dengan dua
kolom tanggal, perpanjangan kedua menimpa yang pertama — dan begitu riwayatnya
hilang, sistem tidak bisa lagi tahu apakah batas itu sudah terlampaui.

Melewati batas mengubah status hubungan kerja menjadi tetap **karena hukum**,
bukan karena keputusan siapa pun. Itu jenis kegagalan kepatuhan yang paling
mahal: tidak kelihatan sampai ada yang mempersoalkannya, dan saat itu buktinya
sudah tidak ada.

## Aturan yang ditegakkan dan yang hanya diperingatkan

| Aturan | Perlakuan |
|---|---|
| Probasi maksimal **3 bulan** (UU 13/2003 pasal 60) | **Ditolak.** Di atas itu klausul percobaannya batal, dan memberhentikan orang dengan dasar itu menjadi PHK yang tidak sah |
| PKWTT tidak boleh punya tanggal berakhir | **Ditolak** — "tidak tertentu sampai tanggal 30" bukan sesuatu yang ada |
| PKWT dan probasi wajib punya tanggal berakhir | **Ditolak** |
| Kontrak aktif yang tumpang tindih | **Ditolak** — dua kontrak aktif berarti dua jawaban untuk "sekarang dia berstatus apa" |
| Total PKWT melewati **5 tahun** (PP 35/2021) | **Diperingatkan**, kontraknya tetap dibuat |
| Perpanjangan ke berapa | **Diperingatkan** (`pkwt:RENEWAL_NUMBER_3`) |

Batas lima tahun diperingatkan, bukan ditolak, karena ada susunan yang sah yang
tidak terlihat dari sini: jeda masa kerja yang sungguh terjadi, atau badan hukum
yang berbeda. Jadi HR diberi tahu apa kata aturannya dan apa yang kontrak ini
lakukan, lalu HR yang memutuskan. Peringatannya ikut di respons pembuatan dan di
log.

## Endpoint

```bash
# Membuat kontrak
curl -X POST https://<host>/api/v1/employees/contracts \
  -H "Authorization: Bearer $HR_TOKEN" -H "Content-Type: application/json" \
  -d '{"employeeId":"<uuid>","type":"PKWT","startDate":"2026-01-01T00:00:00Z","endDate":"2026-12-31T00:00:00Z","contractNumber":"PKWT/2026/001"}'

# Yang akan berakhir
curl -H "Authorization: Bearer $HR_TOKEN" \
  "https://<host>/api/v1/employees/contracts/expiring?days=30"

# Riwayat satu karyawan
curl -H "Authorization: Bearer $HR_TOKEN" \
  "https://<host>/api/v1/employees/contracts?employeeId=<uuid>"

# Menutup kontrak (ENDED / TERMINATED / RENEWED)
curl -X PATCH -H "Authorization: Bearer $HR_TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"RENEWED"}' \
  https://<host>/api/v1/employees/contracts/<id>/status
```

Menandai `RENEWED` adalah cara membuka jalan bagi kontrak berikutnya — pagar
tumpang tindih menolak kontrak baru selama yang lama masih `ACTIVE`.

## Pengingat

Sweep harian mencari kontrak aktif yang berakhir dalam 30, 14, atau 7 hari, lalu
memberi tahu:

- **atasan langsung** — karyawan yang menempati posisi tujuan `reportsTo` dari
  posisi si karyawan;
- **HR dan admin perusahaan** — pemegang role `HR_MANAGER`, `HR_STAFF`, atau
  `COMPANY_ADMIN` di perusahaan itu.

Audiens dipilih berdasarkan **role**, bukan permission, karena penerima
pengingat kontrak adalah sebuah jabatan, bukan sebuah kapabilitas — dan kode
role adalah hal yang bisa dinalar administrator.

**Satu pemberitahuan per offset.** Offset terakhir yang terkirim dicatat di
barisnya, jadi sweep yang berjalan setiap hari tidak mengulang dirinya:
pengingat yang datang tiga puluh kali adalah kebisingan yang justru dilatih
untuk diabaikan. Saat tanggalnya makin dekat, offset yang lebih rapat dikirim
sekali lagi.

Kalau tidak ada penerima yang bisa diberi tahu, offsetnya **tetap dicatat** —
kalau tidak, sweep akan mencoba lagi setiap hari untuk pemberitahuan yang tidak
akan pernah terkirim.

Sweep berjalan lewat queue (`LEAVE_AUTOMATION`, sehari sekali). Kalau queue
mati, ada peringatan di log — tanpa itu kontrak berakhir tanpa pemberitahuan,
yaitu justru kegagalan yang fitur ini ada untuk mencegahnya.

## Verifikasi

26 test: penghitungan bulan (termasuk tanggal yang belum lewat di bulan
terakhir), setiap aturan yang ditolak dan yang diperingatkan, batas lima tahun
terhadap riwayat perpanjangan, penomoran perpanjangan, kontrak tetap dibuat saat
peringatan menyala, serta pengingat: satu kali per offset, offset yang lebih
rapat menyusul, akun atasan tidak aktif dilewati tetapi HR tetap diberi tahu,
dan offset dicatat meski tidak ada penerima.
