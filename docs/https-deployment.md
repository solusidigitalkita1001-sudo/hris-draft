# HTTPS deployment gate

The tracked HTTPS override terminates TLS in the repository Nginx service,
redirects HTTP to HTTPS, forwards `X-Forwarded-Proto: https`, and enables HSTS.
Certificate material remains outside the repository and is mounted read-only.

## Prerequisites

- A DNS name whose A/AAAA record resolves to the deployment host.
- TCP ports 80 and 443 open at the host firewall/security group.
- A valid certificate chain and private key for that DNS name.
- `APP_URL` and every browser origin in `CORS_ORIGINS` using `https://`.
- `COOKIE_SECURE=true` for the API containers.

Never use the server IP or a self-signed certificate for release acceptance.
The mobile client must validate the normal public certificate chain.

## Environment

Keep these values in the deployment secret/environment store, not in Git:

```dotenv
APP_URL=https://hris.example.com
CORS_ORIGINS=https://hris.example.com
COOKIE_SECURE=true
TLS_CERTIFICATE_PATH=/etc/letsencrypt/live/hris.example.com/fullchain.pem
TLS_PRIVATE_KEY_PATH=/etc/letsencrypt/live/hris.example.com/privkey.pem
```

The certificate paths are host paths. They are mounted into Nginx as read-only
files by `deploy/compose-https.override.yml`.

## Issuing the certificate on this VPS (Let's Encrypt)

Chosen path, 18 Oct 2026: a subdomain pointed at the existing host, certificate
from Let's Encrypt, renewed automatically. One-time cost is the DNS record.

```bash
DOMAIN=api.example.com     # ganti dengan subdomain yang kamu pilih
EMAIL=you@example.com      # untuk notifikasi kedaluwarsa dari Let's Encrypt
```

1. **DNS** — buat record `A` (dan `AAAA` kalau host punya IPv6) untuk `$DOMAIN`
   ke IP VPS. Tunggu sampai `dig +short $DOMAIN` mengembalikan IP itu; jangan
   lanjut sebelum benar, karena Let's Encrypt memverifikasi lewat DNS publik.

2. **Pastikan port 80 kosong** — issuance memakai HTTP-01:

   ```bash
   ss -lntp | grep ':80 ' || echo "port 80 bebas"
   ```

   Kalau ada yang memakainya, hentikan sebentar (`docker compose stop nginx`)
   atau pakai mode `--webroot` dengan direktori yang di-serve proses itu.

3. **Terbitkan**:

   ```bash
   sudo certbot certonly --standalone -d "$DOMAIN" -m "$EMAIL" --agree-tos --no-eff-email
   ```

   Hasilnya di `/etc/letsencrypt/live/$DOMAIN/fullchain.pem` dan `privkey.pem`.

4. **Isi `backend/.env` di server** (file ini dipertahankan antar deploy):

   ```dotenv
   APP_URL=https://api.example.com
   CORS_ORIGINS=https://api.example.com
   COOKIE_SECURE=true
   TLS_CERTIFICATE_PATH=/etc/letsencrypt/live/api.example.com/fullchain.pem
   TLS_PRIVATE_KEY_PATH=/etc/letsencrypt/live/api.example.com/privkey.pem
   ```

   Frontend perlu di-build ulang dengan `VITE_API_URL=https://api.example.com/api/v1`,
   kalau tidak halaman HTTPS akan memanggil API HTTP dan diblokir browser.

5. **Renewal hook** — `nginx` ada di dalam container, jadi reload-nya lewat
   Docker. Tanpa hook, sertifikat diperbarui tapi nginx tetap memegang yang lama:

   ```bash
   sudo tee /etc/letsencrypt/renewal-hooks/deploy/hris-nginx.sh >/dev/null <<'HOOK'
   #!/bin/sh
   set -e
   docker exec hris_nginx nginx -t
   docker exec hris_nginx nginx -s reload
   HOOK
   sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/hris-nginx.sh
   sudo certbot renew --dry-run
   ```

Setelah ini, lanjut ke bagian berikut untuk menyalakan override-nya.

## Validate and deploy

Run the Compose validation before changing the live service:

```bash
docker compose \
  --env-file backend/.env \
  -f docker-compose.prod.yml \
  -f deploy/compose-https.override.yml \
  config --quiet
```

Then recreate Nginx and the API containers so their secure URL/cookie settings
take effect:

```bash
docker compose \
  --env-file backend/.env \
  -f docker-compose.prod.yml \
  -f deploy/compose-https.override.yml \
  up -d --build --force-recreate backend worker nginx frontend
```

For the repository deployment workflow, set the GitHub Actions repository
variable `HTTPS_ENABLED` to `true` only after the certificate paths and HTTPS
application values above exist in the server's preserved `backend/.env`. The
deployment script then loads that env file and automatically composes the HTTPS
override. Leaving the variable unset preserves the existing HTTP deployment.

Validate from outside the server network:

```bash
curl --fail --show-error --location http://hris.example.com/nginx-health
curl --fail --show-error https://hris.example.com/nginx-health
curl --fail --show-error https://hris.example.com/health/ready
```

The HTTP request must redirect to HTTPS, TLS verification must succeed without
`--insecure`, and the API health request must return success. Finally run
`scripts/mobile-api-smoke.mjs` against the HTTPS API base URL.

Certificate issuance/renewal is an infrastructure responsibility. This setup
does not fabricate a certificate or alter DNS. A renewal hook must validate
`nginx -t` and reload Nginx after replacing the mounted files.
