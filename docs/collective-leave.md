# Cuti bersama

Keputusan organisasi (GAP-08, 30 September 2026): cuti bersama **memotong saldo
cuti tahunan**, dideklarasikan per perusahaan dengan **pengecualian per cabang**,
dan karyawan yang saldonya tidak cukup jatuh ke **unpaid** — bukan saldo minus.

Saldo minus ditolak bukan karena sulit dibuat, tetapi karena ia merembet: angka
negatif itu ikut terbawa ke perhitungan payroll dan pesangon, dan baru terlihat
saat karyawan berhenti.

## Tiga langkah, sengaja dipisah

Memotong saldo seluruh perusahaan dalam satu klik tanpa bisa dilihat dulu adalah
cara yang buruk untuk memperlakukan hak karyawan. Karena itu deklarasi, tinjauan,
dan penerapan adalah tiga langkah terpisah.

### 1. Deklarasi — belum menyentuh saldo siapa pun

```bash
curl -X POST https://<host>/api/v1/leave/collective \
  -H "Authorization: Bearer $HR_TOKEN" -H "Content-Type: application/json" \
  -d '{
    "date": "2026-12-24T00:00:00.000Z",
    "name": "Cuti Bersama Natal",
    "leaveTypeId": "<uuid cuti tahunan>",
    "unpaidLeaveTypeId": "<uuid cuti tidak dibayar>",
    "excludedBranchIds": ["<uuid cabang yang tetap buka>"]
  }'
```

Yang diperiksa saat deklarasi: tanggal tidak berada di periode payroll yang
sudah ditutup; kedua jenis cuti milik perusahaan itu, aktif, dan berbeda; yang
memotong harus jenis **berbayar**, yang jadi jatuhan harus jenis **tidak
dibayar**; cabang yang dikecualikan memang milik perusahaan itu.

### 2. Tinjauan — siapa yang terdampak, dan bagaimana

```bash
curl -H "Authorization: Bearer $HR_TOKEN" \
  https://<host>/api/v1/leave/collective/<id>/preview
```

Mengembalikan setiap karyawan beserta hasil yang akan terjadi, tanpa menulis apa
pun:

| Hasil | Arti |
|---|---|
| `DEDUCTED` | saldo cuti tahunannya cukup; satu hari akan dipotong |
| `UNPAID` | saldonya habis atau belum pernah dialokasikan; harinya menjadi cuti tidak dibayar |
| `SKIPPED_EXISTING_LEAVE` | sudah punya cuti (PENDING/APPROVED) pada tanggal itu |
| `SKIPPED_ATTENDANCE` | sudah tercatat absensi pada tanggal itu |

`UNPAID` mengurangi penghasilan karyawan. Itu harus terlihat di sini, bukan
ditemukan di slip gaji.

### 3. Penerapan

```bash
curl -X POST -H "Authorization: Bearer $HR_TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  https://<host>/api/v1/leave/collective/<id>/apply
```

Membutuhkan permission `leave:approve` — lebih ketat daripada mendeklarasikan,
karena inilah langkah yang menyentuh saldo.

## Diwujudkan sebagai cuti, bukan penanda kalender

Setiap karyawan yang terdampak mendapat satu `LeaveRequest` berstatus
**APPROVED** untuk hari itu, dengan `collectiveLeaveId` yang menunjuk
deklarasinya. Konsekuensinya menguntungkan:

- **payroll** membacanya lewat kalender absensi yang sudah ada, termasuk aturan
  bahwa cuti berbayar menang atas cakupan tidak dibayar pada hari yang sama;
- **karyawan** melihatnya di riwayat cutinya sendiri, dengan alasan yang jelas
  (`Cuti bersama: <nama>`), bukan sebagai hari yang hilang tanpa penjelasan;
- **laporan** cuti tidak butuh jalur khusus.

## Yang dilindungi

| Pagar | Yang dicegah |
|---|---|
| `@@unique([companyId, date])` | dua deklarasi pada tanggal yang sama |
| `@@unique([collectiveLeaveId, employeeId])` | satu deklarasi memotong saldo orang yang sama dua kali |
| `updateMany` bersyarat `DECLARED` | dua HR menekan *apply* bersamaan lalu semua orang terpotong dua hari |
| Satu transaksi untuk seluruh perusahaan | separuh perusahaan cuti dan separuh tidak — payroll bulan itu akan dihitung dari hari yang setengah diterapkan, dan tidak ada yang tahu separuh yang mana |
| `FOR UPDATE` pada baris saldo | saldo yang habis terpakai oleh approval cuti biasa di antara tinjauan dan penerapan; kalau habis, karyawan itu jatuh ke unpaid, bukan minus |
| Guard periode payroll | mengubah hari pada periode yang sudah dibayar dan direkonsiliasi |
| Pengecualian NULL cabang dieksplisitkan | `branchId NOT IN (...)` bernilai UNKNOWN untuk karyawan tanpa cabang, yang diam-diam mengeluarkan mereka dari hari itu (ini sempat terjadi dan ditangkap test) |

Diverifikasi di MySQL sungguhan: 12 test di `collective-leave.mysql.test.ts`,
termasuk potongan saldo, jatuhan unpaid tanpa pernah di bawah nol, cabang yang
dikecualikan, cuti dan absensi yang sudah ada, penerapan yang hanya sekali, dan
penolakan konfigurasi jenis cuti yang salah.

## Yang sengaja belum ada

**Membalik hari yang sudah diterapkan.** Mengembalikan saldo dan menghapus cuti
yang sudah disetujui adalah keputusan tersendiri — terutama bila payroll periode
itu sudah berjalan — jadi `DELETE` hanya menerima deklarasi yang belum
diterapkan, dan pesan errornya mengatakan itu apa adanya.
