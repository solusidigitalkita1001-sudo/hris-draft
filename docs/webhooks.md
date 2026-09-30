# Webhook

Cara sistem luar mengetahui sesuatu terjadi di HRIS tanpa polling (GAP-38).
Dokumen ini untuk pengembang yang menerima panggilannya.

## Berlangganan

```bash
curl -X POST https://<host>/api/v1/webhooks \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{
    "url": "https://hooks.perusahaan.com/hris",
    "events": ["payroll.run.approved", "employee.created"],
    "description": "Sinkron ke sistem akuntansi"
  }'
```

Responsnya memuat `secret` — **satu-satunya kali ia muncul**. Simpan sekarang;
ia dipakai untuk memverifikasi tanda tangan setiap panggilan. Yang tersimpan di
server terenkripsi (bukan hash, karena HMAC butuh secret-nya utuh), dan endpoint
daftar tidak pernah mengembalikannya dalam bentuk apa pun.

Katalog event yang bisa diikuti: `GET /api/v1/webhooks/events`.

## Katalognya sengaja tidak memuat semua event

Event autentikasi (login, refresh token, akun terkunci) tidak diterbitkan.
Mengalirkannya ke endpoint luar akan menjadikan langganan webhook sebagai umpan
keamanan, dan integrator hampir tidak pernah membutuhkannya. Selain itu, nama
yang diterbitkan adalah janji: begitu sebuah sistem dibangun di atas
`payroll.run.approved`, nama dan bentuk payload-nya tidak bisa diubah
sembarangan.

Isi katalog adalah fakta bisnis — sesuatu terjadi pada karyawan, payroll run,
atau lamaran kerja — dan setiap event membawa `companyId`, yang dipakai untuk
menentukan tenant mana yang dikirimi.

## Bentuk panggilan

`POST` ke URL-mu, `Content-Type: application/json`:

```json
{
  "id": "0f1e...",
  "event": "payroll.run.approved",
  "occurredAt": "2026-09-30T04:15:00.000Z",
  "aggregate": { "id": "run-uuid", "type": "PayrollRun" },
  "data": { "companyId": "company-uuid", "runNumber": 7 }
}
```

| Header | Isi |
|---|---|
| `X-HRIS-Event` | nama event |
| `X-HRIS-Delivery` | id pengiriman — pakai untuk idempotensi di sisimu |
| `X-HRIS-Timestamp` | epoch detik, **ikut ditandatangani** |
| `X-HRIS-Signature` | `sha256=<hex>` |

### Memverifikasi tanda tangan

```js
const expected = crypto.createHmac('sha256', secret)
  .update(`${req.header('X-HRIS-Timestamp')}.${rawBody}`)
  .digest('hex');
const ok = crypto.timingSafeEqual(
  Buffer.from(expected, 'hex'),
  Buffer.from(req.header('X-HRIS-Signature').replace('sha256=', ''), 'hex'),
);
```

Tandatangani **raw body**, bukan hasil JSON.parse lalu stringify ulang — urutan
kunci bisa berubah dan tanda tangannya gagal.

Timestamp ikut ditandatangani supaya kamu bisa menolak panggilan yang basi.
Menandatangani body saja akan membuat payload yang pernah terekam bisa diputar
ulang selamanya. Tolak apa pun yang lebih tua dari, misalnya, lima menit.

## Pengiriman ulang dan urutan

- **Balas 2xx secepat mungkin**, lalu kerjakan di belakang. Timeout kami 10
  detik.
- **Balas non-2xx atau timeout → dicoba lagi** dengan backoff 30 detik, 2 menit,
  10 menit, 1 jam, 6 jam; menyerah setelah **6 percobaan** (status `DEAD`).
- **Satu event bisa datang lebih dari sekali** dalam kasus jaringan yang jarang.
  Pakai `X-HRIS-Delivery` atau `id` payload untuk idempotensi. Di sisi kami ada
  pagar `(subscriptionId, eventId)` yang unik, jadi event yang dikirim ulang
  oleh queue internal tidak menjadi dua panggilan — tetapi jangan bergantung
  hanya pada itu.
- **Urutan tidak dijamin.** Pakai `occurredAt`.
- **Endpoint yang gagal 20 kali berturut-turut dimatikan sendiri**, dengan
  alasannya tercatat di `disabledReason`. Administrator mengaktifkannya kembali
  lewat `PATCH /webhooks/:id` dengan `{"isActive": true}` — yang juga mereset
  hitungan kegagalan.

## Melihat apa yang terjadi

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://<host>/api/v1/webhooks/deliveries?status=FAILED&limit=50"
```

Setiap percobaan tercatat: payload, status HTTP jawaban, error terakhir, jumlah
percobaan, dan kapan percobaan berikutnya. Tanpa ini, "webhook saya tidak masuk"
tidak punya bukti untuk ditelusuri.

## Batas keamanan

URL webhook adalah alamat yang **diambil server atas perintah tenant**, jadi ia
adalah primitif SSRF kalau tidak dipagari. Yang ditolak:

- skema selain `https` (produksi), URL dengan kredensial tertanam, port
  tidak lazim;
- `localhost`, akhiran `.localhost`/`.internal`;
- alamat privat dan loopback, termasuk bentuk yang menyamar: `127.0.0.1`,
  `10/8`, `172.16/12`, `192.168/16`, CGNAT `100.64/10`, multicast,
  **`169.254.169.254` (metadata cloud)**, `::1`, `fe80::/10`, `fc00::/7`, dan
  IPv4-mapped IPv6 dalam **dua** ejaan (`::ffff:10.0.0.1` maupun bentuk hex
  `::ffff:a00:1` yang dihasilkan normalisasi URL — yang kedua sempat lolos dan
  ditangkap test).

Pemeriksaan dilakukan **dua kali**: saat berlangganan, dan **lagi saat
pengiriman terhadap alamat hasil resolusi DNS** — karena nama yang tadinya
publik bisa menunjuk ke `127.0.0.1` satu jam kemudian (DNS rebinding).
Redirect tidak diikuti (`redirect: 'manual'`), karena redirect bisa menuju
tempat privat.

Payload memuat data perusahaan itu sendiri, dikirim ke endpoint yang
administratornya sendiri daftarkan. Tetap perlakukan `data` sebagai data
pegawai: gunakan HTTPS, dan jangan catat payload ke log yang bisa dibaca luas.

## Verifikasi

31 test pagar URL (termasuk seluruh bentuk alamat privat di atas) dan 18 test
layanan: fan-out hanya ke langganan yang memintanya, event tanpa company
diabaikan, dedupe, bentuk tanda tangan, retry dengan backoff, menyerah setelah
batas percobaan, langganan mati sendiri setelah gagal berulang, dan satu
endpoint yang error tidak menghentikan tenant lain.
