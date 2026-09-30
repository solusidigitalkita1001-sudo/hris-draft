# Pencairan sisa cuti (leave encashment)

GAP-09. Keputusanmu: *"bikin settingan nya di organization biar dinamis aja"* —
jadi kebijakannya **per perusahaan dan bisa diubah**, bukan satu nilai yang
dipilih lalu ditanam di kode.

## Kenapa settingan, bukan satu jawaban

Dasar perhitungan per hari berbeda antar perusahaan di Indonesia: ada yang
memakai gaji pokok ÷ 21 (hari kerja), ada ÷ 30 (hari kalender), ada yang
menyertakan tunjangan tetap, ada yang tidak. Satu nilai yang ditanam di kode
akan menjadi permintaan perubahan kode setiap kali ada perusahaan baru memakai
produk ini.

| Setting | Default | Arti |
|---|---|---|
| `leave_encashment_enabled` | `false` | fitur mati sampai dinyalakan |
| `leave_encashment_max_days_per_year` | `0` | batas hari per tahun; `0` = tanpa batas selain saldo karyawan |
| `leave_encashment_daily_divisor` | `21` | tarif harian = upah bulanan ÷ nilai ini |
| `leave_encashment_include_allowances` | `false` | tunjangan tetap ikut jadi dasar atau tidak |

**Mati secara default**, seperti setiap setting yang menggerakkan uang:
menyalakannya keputusan tenant, bukan konsekuensi deploy.

Divisor `0`, negatif, atau bukan angka jatuh kembali ke 21 — pembagi nol akan
membagi nol tepat ke dalam gaji seseorang.

`GET /api/v1/leave/encashment/policy` mengembalikan kebijakan yang berlaku
beserta rumusnya, supaya antarmuka bisa menjelaskan dirinya sendiri sebelum ada
yang bertanya.

## Alurnya

```bash
# 1. Mengajukan — belum menyentuh saldo
curl -X POST https://<host>/api/v1/leave/encashment \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"employeeId":"<uuid>","leaveTypeId":"<uuid cuti tahunan>","days":2}'

# 2. Menyetujui — saldo dipotong di sini
curl -X PATCH -H "Authorization: Bearer $HR_TOKEN" \
  https://<host>/api/v1/leave/encashment/<id>/approve

# 3. Dibayar otomatis pada run payroll berikutnya
```

**Nominal tidak ada di API.** Ia diturunkan server dari gaji aktif dan
kebijakan yang berlaku, lalu disimpan bersama `basis` (gaji, pembagi, tarif
harian, tunjangan ikut atau tidak) supaya bisa ditelusuri. Mengetik nominal
uang dengan tangan adalah cara termudah salah bayar sampai ke berkas transfer.

**Saldo dipotong saat disetujui, bukan saat diajukan** — pengajuan yang ditolak
tidak boleh memakan hak cuti siapa pun.

**Uangnya lewat payroll**, bukan pembayaran terpisah: baris yang disetujui
diambil run berikutnya sebagai komponen `Pencairan <jenis cuti> (N hari)`, kena
pajak pada bulan pembayaran seperti penghasilan biasa. Polanya sama dengan
rapel, dan memakai disiplin yang sama.

## Yang dilindungi

| Pagar | Yang dicegah |
|---|---|
| Saldo dibaca ulang di bawah `FOR UPDATE` saat menyetujui | approval cuti biasa memakai hari itu di antara pengajuan dan persetujuan — membayar cuti yang sudah tidak dimiliki berarti membayar dua kali untuk satu hak |
| Batas tahunan menghitung hari yang sudah diajukan **dan** dibayar | dua pengajuan yang masing-masing patuh, tetapi bersama melewati batas |
| Maker-checker | orang yang sama mengajukan lalu menyetujui pencairannya sendiri |
| Hanya jenis cuti **berbayar** | mencairkan cuti tidak dibayar, yaitu membayar hari yang tidak pernah menjadi upah |
| `updateMany` bersyarat di setiap transisi | dua approval bersamaan memotong saldo dua kali |
| Klaim run bersyarat `APPROVED` | run kedua membayar baris yang sudah dibayar — hitungannya bukan 1, seluruh run gagal |
| Komponen `isProrated: false` | nominal yang sudah dihitung dari tarif harian diprorata lagi terhadap periode |

## Verifikasi

32 test: setiap kombinasi kebijakan (divisor 21 dan 30, tunjangan ikut atau
tidak, divisor tidak valid), batas tahunan terhadap hari yang sudah diajukan,
saldo tidak cukup pada pengajuan maupun pada persetujuan, jenis cuti tidak
berbayar/tidak aktif/milik perusahaan lain, gaji non-IDR, maker-checker,
transisi yang diserobot orang lain, dan klaim ganda di payroll.
