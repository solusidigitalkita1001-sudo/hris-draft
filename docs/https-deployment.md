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
  up -d --build --force-recreate api api-replica nginx
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
