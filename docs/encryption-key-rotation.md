# Rotating ENCRYPTION_KEY

`ENCRYPTION_KEY` keys the AES-256-GCM encryption of small server-held secrets:
TOTP secrets (`auth.service`), push device tokens
(`mobile-device.repository`), and payroll unlock material. Until now a single
key was used for both directions, so replacing it made every stored
`enc:v1:` value undecryptable — which is why a deployment whose key was still
the shipped placeholder could not simply be corrected in place.

`ENCRYPTION_KEY_PREVIOUS` is the rotation path. Decryption tries the current
key, then the previous one; encryption only ever uses the current key.

## Why the deploy failed before this existed

`config/index.ts` rejects a placeholder-shaped secret when `NODE_ENV=production`
(`dev-`, `your-`, `test-`, `example`, `change-me`). The production `backend/.env`
still held the shipped placeholder, so the backend container exited on startup
with `ENCRYPTION_KEY: placeholder/dev value is not allowed in production`, the
deploy's health check never passed, and the workflow auto-rolled back to the
previous commit. The guard is correct; the environment was not.

`ENCRYPTION_KEY_PREVIOUS` is deliberately **not** in that guarded list: while
rotating away from a placeholder, the placeholder is the correct previous value.

## Procedure

1. Generate a key and keep the old one at hand:

   ```bash
   openssl rand -base64 48
   ```

2. On the server, edit `backend/.env`:

   ```dotenv
   ENCRYPTION_KEY=<the new random value>
   ENCRYPTION_KEY_PREVIOUS=<the exact previous value, placeholder included>
   ```

   Copy the previous value verbatim — a whitespace difference is a different
   key, and the fallback will not match.

3. Deploy. `ENCRYPTION_KEY_PREVIOUS` may look like a placeholder without
   tripping the production guard.

4. Confirm the fallback is actually being used before removing it: a user with
   MFA enabled can still log in with their existing authenticator, and push
   delivery does not start reporting `INVALID_TOKEN` for previously registered
   devices.

5. Remove `ENCRYPTION_KEY_PREVIOUS` only once every stored value has been
   rewritten under the new key. Values are rewritten when they are next
   written, not on read, so the safe options are to leave the variable in place
   or to force a rewrite — re-enrolling MFA and letting devices re-register.

## If the previous key is lost

Nothing can recover those values; they have to be re-created:

- MFA: disable it for the affected users so they can re-enroll.
- Push tokens: no action needed. Delivery marks an undecryptable token
  inactive and the app registers a fresh one on next launch.
- Payroll unlock sessions: none needed. They are short-lived by design.

## Status produksi — 29 September 2026

**Deploy production sedang tertahan di langkah ini.** `main` berisi seluruh
pekerjaan sampai `3b5a0b3`, tetapi server masih menjalankan commit `4390019`
(sebelum PR #6) karena setiap deploy berhenti dengan:

```
[FATAL] Invalid environment configuration:
  - ENCRYPTION_KEY: placeholder/dev value is not allowed in production
```

Auto-rollback bekerja setiap kali, jadi production tetap sehat — hanya tidak
mendapat kode baru. Lima kali deploy gagal dengan sebab yang sama (run 36447545390,
36471907328, 36472003912, 36586544275, 36587188692, 36588002485).

Yang membuka blokirnya, dijalankan sekali di server sebagai satu blok:

```bash
cd /root/projects/dev/hris-draft/backend
cp -p .env ".env.bak.$(date +%F-%H%M%S)"
OLD=$(grep '^ENCRYPTION_KEY=' .env | cut -d= -f2-)
NEW=$(openssl rand -base64 48 | tr -d '\n')
if grep -q '^ENCRYPTION_KEY_PREVIOUS=' .env; then
  sed -i "s|^ENCRYPTION_KEY_PREVIOUS=.*|ENCRYPTION_KEY_PREVIOUS=${OLD}|" .env
else
  printf 'ENCRYPTION_KEY_PREVIOUS=%s\n' "${OLD}" >> .env
fi
sed -i "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=${NEW}|" .env
grep -E '^ENCRYPTION_KEY(_PREVIOUS)?=' .env | sed 's/=.\{0,6\}.*/=<set>/'
```

Kunci baru dibuat di server sehingga tidak pernah melewati chat atau repo,
`.env` lama dicadangkan, dan blok ini aman diulang. Setelah itu jalankan
`gh workflow run "🚀 Deploy HRIS"` lalu verifikasi sesuai langkah 4 di atas.

Jangan melonggarkan guard placeholder agar deploy hijau: guard itulah yang
menahan kunci contoh dari repo dipakai mengenkripsi TOTP dan push token
produksi.
