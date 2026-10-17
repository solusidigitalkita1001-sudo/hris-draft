FROM nginx:1.25-alpine
# nginx.conf repo WAJIB ikut: dialah yang meng-include /etc/nginx/sites-enabled
# (plus zona rate-limit yang dipakai vhost TLS). Tanpa baris ini, mount
# sites-enabled dari deploy/compose-https.override.yml tidak pernah terbaca —
# persis bug yang membuat jalur HTTPS mati sejak awal.
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf
# Vhost HTTP default hidup di sites-enabled; saat HTTPS dinyalakan, override
# me-mount deploy/nginx-https ke direktori yang sama dan MENGGANTIKANNYA utuh.
COPY docker/nginx/default.conf /etc/nginx/sites-enabled/default.conf
EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
