# Rekonsiliasi PPh21 Desember

GAP-16. Keputusanmu: **koreksi otomatis di slip Desember**, sebagai komponen
terpisah yang terlihat jelas.

## Kenapa ada selisih untuk dikoreksi

Perhitungan bulanan memakai metode annualized net: penghasilan bulan ini
dikalikan dua belas, lalu pajak setahunnya dibagi dua belas. Itu cara yang benar
untuk memotong sepanjang jalan, tetapi **bukan kebenaran tentang tahun itu**
begitu bulan-bulannya berbeda.

Yang membuatnya berbeda: bonus, THR, kenaikan gaji di tengah tahun, perubahan
status PTKP, atau karyawan yang masuk bulan Maret. Untuk semua itu, "bulan ini ×
12" adalah tahun yang tidak pernah benar-benar dialami karyawan.

Karena itu Desember menghitung ulang dari **angka bulanan yang sungguh
diterima**.

## Cara kerjanya

Pada run periode yang berakhir di bulan **Desember**, untuk setiap karyawan:

1. penghasilan bruto kena pajak tiap bulan tahun itu dikumpulkan dari slip pada
   run yang **sudah disetujui**, ditambah bulan yang sedang dibayar;
2. pajak setahun dihitung dari angka itu — biaya jabatan dijumlahkan **per bulan
   dengan batas bulanannya**, bukan sekali terhadap bruto setahun;
3. dibandingkan dengan PPh21 yang **sudah dipotong** sepanjang tahun;
4. selisihnya masuk slip sebagai komponen tersendiri:

| Arah | Komponen | Tipe |
|---|---|---|
| Kurang potong | `Koreksi PPh21 Tahunan` | potongan |
| Lebih potong | `Pengembalian PPh21 Tahunan` | penambah |

**Kedua arah nyata.** Karyawan yang status PTKP-nya berubah di tengah tahun
biasanya justru lebih potong — menolak mengembalikannya berarti diam-diam
menahan uang yang bukan milik perusahaan.

Komponen koreksi sendiri **tidak kena pajak**: ia menyelesaikan pajak, bukan
penghasilan baru.

### Biaya jabatan: per bulan, bukan setahun

Biaya jabatan 5% dengan batas 500 ribu **per bulan**. Menerapkan 5% ke bruto
setahun dengan plafon 6 juta memberi jawaban sama hanya untuk orang yang
penghasilannya rata sepanjang tahun — dan jawaban yang salah untuk semua orang
lain. Satu bulan berisi 240 juta hanya mendapat 500 ribu, bukan 6 juta.

## Menyalakannya

| Setting | Default |
|---|---|
| `pph21_december_reconciliation_enabled` | `false` |

**Mati secara default** karena ia mengubah take-home pay di bulan terakhir
tahun. Keputusanmu adalah mengaktifkannya, tetapi saya tidak menyalakannya
sendiri: itu data tenant-mu, dan menyalakan fitur yang memindahkan uang di
perusahaan orang lain bukan keputusan saya. Nyalakan dengan:

```bash
curl -X PUT https://<host>/api/v1/company-settings/pph21_december_reconciliation_enabled \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"value":"true"}'
```

Selain setting itu, koreksi hanya berjalan pada periode yang **benar-benar
berakhir di Desember**. Menyelesaikan tahun pada bulan Oktober akan memotong
koreksi setahun penuh dari orang yang masih punya dua bulan untuk dibayar —
ada test real-DB yang memakukan itu.

## Batas yang perlu diketahui

- **Hanya run yang sudah disetujui** yang dihitung sebagai "sudah dipotong".
  Run Desember yang masih draft belum menjadi bagian dari tahun.
- **Iuran pensiun** (JHT + JP) yang dikurangkan memakai kebijakan BPJS
  perusahaan pada gaji pokok yang berlaku — angka yang sama dengan yang dipakai
  pemotongan bulanan.
- Kalau tahun itu **tidak punya penghasilan kena pajak sama sekali**, tidak ada
  komponen koreksi yang dibuat. Nol yang terlihat yakin lebih buruk daripada
  tidak melakukan apa-apa: ia akan memasang baris "koreksi: 0" pada slip untuk
  tahun yang sistemnya justru tidak bisa selesaikan.
- Rekap tahunan untuk bukti potong (`docs/annual-tax-recap.md`) membaca slip
  yang sudah disetujui, jadi begitu Desember disetujui, angkanya konsisten
  dengan yang benar-benar dibayar.

## Verifikasi

13 test mesin tahunan (kesesuaian dengan mesin bulanan untuk tahun yang rata,
bonus yang tidak diperlakukan sebagai berulang setiap bulan, karyawan masuk
tengah tahun, batas biaya jabatan per bulan, surcharge tanpa NPWP, di bawah
PTKP, tahun tanpa bulan dibayar), 6 test perakitan angka oleh run (bulan yang
sedang dibayar ikut dihitung, hanya penghasilan kena pajak, pemotongan dibaca
dari komponen pajak saja, kebijakan perusahaan diteruskan, penolakan tahun tanpa
penghasilan), dan 1 test real-DB untuk gerbang bulan.
