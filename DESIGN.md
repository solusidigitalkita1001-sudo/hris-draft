# DESIGN.md — HRIS Web Portal (Redesign 2026-09)

Sumber kebenaran visual: handoff "HRIS Web Redesign" (Claude Design). Mode: **Operate** — portal ESS karyawan + operasional HR. Prototipe referensi ada di luar repo; token & aturan di bawah ini adalah versi ternormalisasi untuk codebase (React + Tailwind).

## Identitas

- **Primary `#315B8C`** (dark mode memakai aksen terang `#8FB4DC`). Hover `#26496F`.
- **Font: Plus Jakarta Sans 300–700.** Gaya tipis — heading weight 600, JANGAN pakai 700/800. Tracking negatif pada heading (`tracking-tight` / -0.6..-1px).
- Dua tema: light & dark. **Dark: chrome (sidebar `#0A111C`, topbar) lebih gelap dari konten (`#121A28`), kartu `#1A2434`** — hirarki ini wajib dipertahankan.
- Radius besar: kartu 24–26px (`rounded-card`), kartu kecil 16–22px (`rounded-card-sm`), input/tombol 13–18px (`rounded-field`), chip `rounded-full`.
- Shadow lembut: `shadow-card` (kartu), `shadow-float` (panel sidebar melayang), `shadow-primary-btn` (CTA), `shadow-nav` (bottom nav).

## Token (sudah tersedia)

CSS vars di `frontend/src/index.css`, Tailwind mapping di `tailwind.config.ts`:

- Surface: `bg-background` (app), `bg-card`, `bg-secondary` (chip), `bg-muted` (track), `bg-accent` (tint `#E7EEF6`/`#22364F`).
- Teks: `text-foreground`, `text-muted-foreground`, aksen `text-primary`.
- Semantik: `text-success`/`bg-success-bg`, `text-warning`/`bg-warning-bg`, `text-danger`/`bg-danger-bg` — chip status memakai pasangan fg/bg ini, bukan gray.
- Garis: `border-border`. Topbar: class utilitas `.topbar-blur` (translucent + blur 16px + hairline).
- JANGAN hardcode `bg-white dark:bg-gray-800` dsb — selalu lewat token.

## Skala tipografi (web)

| Peran | Ukuran | Weight |
|---|---|---|
| Judul halaman | 19–21px (`text-xl`) | 600, tracking -0.9px |
| Judul kartu | 15px | 600 |
| Angka stat besar | 30px | 600, tracking -1.4px |
| Body/tabel | 12–12.5px (`text-sm` diperkecil) | 400–500 |
| Sekunder | 11–11.5px (`text-xs`) | 400 |
| Label uppercase | 9.5–10.5px, tracking .8–1px | 600 |

## App shell

- **Sidebar "Melayang"**: panel kartu `bg-sidebar` margin 14px kiri/atas/bawah, radius 26px, `height: calc(100vh - 28px)`, sticky, `shadow-float`. Expand 246px / collapse 78px, transisi `width .3s cubic-bezier(.22,.9,.3,1)`. Struktur: header logo → daftar menu (`flex-1 min-h-0 overflow-y-auto`) → kartu status absen pinned bawah. Submenu single-expand, caret rotate, child indent 21px + border-left, parent dengan child aktif tetap menyala bar aksen kiri.
- **Topbar** sticky `.topbar-blur`: chip perusahaan, toggle tema (matahari/bulan), switch bahasa ID/EN, ikon notifikasi ber-badge, chip user (avatar+nama+jabatan) → dropdown Profil/Bantuan/Keluar. Hamburger muncul saat sidebar collapse.
- **Mobile < 1024px (lg)**: sidebar → bottom nav 5 ikon (Dashboard · Self · Pinjaman · Notifikasi · Profil-avatar).

## Aturan komponen

- Status pengajuan: chip pill fg/bg semantik (Menunggu = warning, Disetujui = success, Ditolak = danger).
- Tabel = server-side DataTable (pagination/sort/search di server) dalam `table-container` (rounded-2xl border bg-card).
- Ikon: lucide-react, stroke 1.8–2.2. Avatar inisial dengan palet `#5D87B4 #8FABC8 #B3C6DA` + primary.
- Data sensitif payroll: nominal tampil `Rp ••••••` sampai di-unlock (PIN/unlock token server-side).
- Empty/loading/error state wajib; error via `apiErrorMessage`, bukan console.
