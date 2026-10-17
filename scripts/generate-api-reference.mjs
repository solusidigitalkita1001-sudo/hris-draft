#!/usr/bin/env node
/**
 * Regenerasi docs/api-reference.md dari openapi.json server yang berjalan.
 *
 * Dua regenerasi sebelumnya dikerjakan ad-hoc dan skripnya tidak pernah
 * di-commit, jadi dokumen sempat tertinggal ±10 grup route. Sekarang:
 *
 *   TOKEN=... # akun ber-rbac:read, login mobile
 *   curl -s -H "Authorization: Bearer $TOKEN" \
 *     http://127.0.0.1:3000/api/v1/meta/openapi.json > /tmp/openapi.json
 *   node scripts/generate-api-reference.mjs /tmp/openapi.json > docs/api-reference.md
 */
import { readFileSync } from 'node:fs';

const source = process.argv[2];
if (!source) {
  console.error('Pakai: node scripts/generate-api-reference.mjs <openapi.json>');
  process.exit(1);
}
const spec = JSON.parse(readFileSync(source, 'utf8'));

const METHOD_ORDER = ['get', 'post', 'put', 'patch', 'delete'];
const rows = [];
for (const [path, item] of Object.entries(spec.paths ?? {})) {
  for (const method of METHOD_ORDER) {
    const op = item[method];
    if (!op) continue;
    const perms = op['x-required-permissions'];
    rows.push({
      path,
      method: method.toUpperCase(),
      permission: Array.isArray(perms) && perms.length ? perms.map((p) => `\`${p}\``).join(', ') : '—',
      auth: op.security?.length ? 'bearer/cookie' : 'publik',
      body: op.requestBody ? 'ya' : '—',
      group: (path.replace(/^\/api\/v1\//, '').split('/')[0]) || '(root)',
    });
  }
}

const groups = new Map();
for (const row of rows) {
  const list = groups.get(row.group) ?? [];
  list.push(row);
  groups.set(row.group, list);
}

const pathCount = Object.keys(spec.paths ?? {}).length;
const today = new Date().toISOString().slice(0, 10);

const header = `# Referensi API HRIS

Dibuat otomatis dari router yang berjalan pada ${today} — **${pathCount} path, ${rows.length} operasi**.

Dokumen ini tidak ditulis tangan. Sumbernya \`GET /api/v1/meta/openapi.json\`, yang dibangun dengan menyusuri stack Express: path, method, skema request (dikonversi dari skema zod yang benar-benar memvalidasi request), permission yang diminta \`authorize()\`, dan apakah route berada di balik autentikasi. Karena itu isinya tidak bisa menyimpang dari server — kalau sebuah endpoint berubah, dokumen ini berubah saat dibuat ulang. Regenerasi: \`node scripts/generate-api-reference.mjs\` (lihat header skrip).

\`\`\`bash
# ambil sendiri versi terbaru (butuh akun dengan rbac:read)
curl -H "Authorization: Bearer $TOKEN" \\
  https://<host>/api/v1/meta/openapi.json > openapi.json
\`\`\`

## Yang perlu dibaca lebih dulu

- **Bentuk response dan kode error**: \`docs/api-contract.md\`. Semua sukses memakai satu envelope (\`success\`, \`message\`, \`data\`, \`meta\` untuk daftar berhalaman); semua error memakai \`code\` dari katalog tertutup (\`VALIDATION_ERROR\`, \`FORBIDDEN\`, \`CONFLICT\`, …).
- **Autentikasi**: cookie \`httpOnly\` untuk web; klien mobile mengirim \`X-Client-Type: mobile\` saat login lalu \`Authorization: Bearer\` (\`docs/mobile-api.md\`). SSO per perusahaan: \`docs/sso-oidc.md\`.
- **Konteks perusahaan**: hampir semua endpoint terikat perusahaan aktif; \`companyId\` dari klien divalidasi terhadap hak akses pengguna, bukan dipercaya.
- **Idempotency**: mutasi mobile menerima header \`Idempotency-Key\` (replay 24 jam).

Tiga endpoint memakai kredensial yang **bukan** sesi pengguna, dan itu disengaja:
\`/attendance/device\` (API key mesin absensi, \`docs/attendance-device-integration.md\`),
\`/webhooks\` keluar (HMAC per endpoint, \`docs/webhooks.md\`), dan \`/careers\`
(publik tanpa akun, dipagari rate limit per IP — pelamar kerja tidak login).
`;

const sections = [...groups.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([group, list]) => {
    const sorted = [...list].sort((a, b) => a.path.localeCompare(b.path) || METHOD_ORDER.indexOf(a.method.toLowerCase()) - METHOD_ORDER.indexOf(b.method.toLowerCase()));
    const body = sorted
      .map((row) => `| \`${row.method} ${row.path}\` | ${row.permission} | ${row.auth} | ${row.body} |`)
      .join('\n');
    return `## \`${group}\` — ${list.length} operasi\n\n| Method & path | Permission | Auth | Body |\n|---|---|---|---|\n${body}\n`;
  });

process.stdout.write(`${header}\n${sections.join('\n')}`);
