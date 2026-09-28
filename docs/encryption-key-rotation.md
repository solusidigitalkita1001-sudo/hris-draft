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
