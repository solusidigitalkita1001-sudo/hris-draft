# Asset Management

Register aset perusahaan: siapa memegang apa, dalam kondisi apa, bernilai
buku berapa — dan apa yang terjadi padanya saat karyawan keluar.

## Model

- **Asset** — satu barang fisik, ber-`assetCode` unik per company (kode
  stiker fisik boleh dipakai saat create; sistem men-generate `AST-…` bila
  kosong; kode TIDAK bisa diubah setelahnya). Status: `AVAILABLE` ⇄
  `ASSIGNED` ⇄ `MAINTENANCE` / `RETIRED`.
- **AssetAssignment** — riwayat pegangan: siapa, sejak kapan, kondisi saat
  serah dan saat kembali. Baris aktif = `returnedAt: null`.
- **AssetCategory** — memegang `depreciationMethod` (4 metode) dan
  `usefulLifeMonths`; tanpa kategori, depresiasi jatuh ke garis lurus 4
  tahun.

Model `AssetPatrolLog` lama dihapus (migrasi `20261016141948`) — nol kode
yang memakainya sejak dibuat; patrol/stock-opname adalah fitur masa depan
yang layak desain sendiri.

## Siklus hidup

| Aksi | Route | Aturan |
|---|---|---|
| Create | `POST /assets` | kode stiker opsional; kategori divalidasi se-company |
| Edit | `PUT /assets/:id` | kode terkunci; `status` hanya `AVAILABLE/MAINTENANCE/RETIRED` dan DITOLAK selama aset dipegang |
| Hapus | `DELETE /assets/:id` | soft delete; ditolak selama dipegang |
| Serah | `POST /assets/:id/assign` | hanya `AVAILABLE`; karyawan divalidasi se-tenant |
| Kembali | `POST /assets/:id/return` | `DAMAGED`/`LOST` → `MAINTENANCE`, lainnya → `AVAILABLE` |
| Alih | `POST /assets/:id/transfer` | hanya `ASSIGNED`; tutup+buka pegangan dalam SATU transaksi, conditional+counted (anti-race) |
| Kategori | `GET/POST/PUT/DELETE /assets/categories[/:id]` | hapus ditolak selama masih dipakai aset |
| Self-service | `GET /assets/my` | tanpa izin khusus; berpaginasi; tanpa nilai finansial |
| Outstanding | `GET /assets/outstanding/:employeeId` | pegangan aktif + nilai buku saat ini — bahan clearance & beban aset hilang |
| Depresiasi | `GET /assets/:id/depreciation` | skema + nilai buku; metode/umur dari kategori, bisa di-override query |

Semua mutasi diaudit (`auditLog`). Permission memakai resource sendiri:
`asset:read/create/update/delete` — COMPANY_ADMIN (semua), HR_MANAGER
(read/create/update), HR_STAFF (read/update untuk serah-terima harian).
**Jalankan ulang seed** setelah deploy supaya grant terpasang.

## Integrasi exit clearance

Setiap resign baru mendapat item clearance **"Pengembalian aset perusahaan"**
(departemen GA). Item itu MENOLAK di-set `CLEARED` selama karyawan masih
memegang aset — aset hilang dicatat lewat return berkondisi `LOST` (jejak +
nilai buku untuk beban di final payroll), bukan dengan meng-CLEAR tangan
kosong. Konstanta item: `ASSET_CLEARANCE_ITEM` di `asset.service.ts`.
Resign lama (dibuat sebelum fitur ini) tidak punya item tersebut — gerbangnya
berlaku untuk resign baru.

## Batas yang disengaja

- Stock opname / patrol, foto kondisi, QR scan, dan berita acara PDF belum
  ada — data serah terimanya (kondisi, tanggal, pencatat) sudah terekam di
  `AssetAssignment`, tinggal dirender bila dibutuhkan.
- `branchId` belum divalidasi terhadap master cabang.
- Depresiasi read-only: belum ada posting ke akuntansi/ekspor jurnal.
