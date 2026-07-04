# Infra Stack: Load Balancer, RabbitMQ, Redis

## Yang Sudah Diterapkan

- `Nginx` sebagai load balancer untuk dua instance API: `api` dan `api-replica`.
- `Redis` sebagai shared state untuk cache dan BullMQ queue backend.
- `RabbitMQ` sebagai broker domain event lintas instance.
- `BullMQ worker` sebagai background processor untuk job `domain-events`.

## Komponen Utama

- `docker-compose.yml`
  - Menjalankan `mysql`, `redis`, `rabbitmq`, `api`, `api-replica`, `worker`, dan `nginx`.
- `docker/nginx/sites/default.conf`
  - Upstream `api_servers` sekarang membagi request ke `api:3000` dan `api-replica:3000`.
- `backend/src/infrastructure/messaging/RabbitMQBroker.ts`
  - Koneksi, publish, dan consume RabbitMQ.
- `backend/src/infrastructure/queue/QueueManager.ts`
  - Queue manager BullMQ berbasis Redis.
- `backend/src/worker.ts`
  - Worker background untuk memproses queue dan consume event RabbitMQ.
- `backend/src/shared/events/EventBus.ts`
  - Domain event lokal sekarang juga dipublish ke RabbitMQ dan di-enqueue ke BullMQ.

## Health Check

- API health: `GET /health`
- Nginx health: `GET /nginx-health`
- RabbitMQ management UI: `http://localhost:15672`

## Cara Menjalankan

```bash
docker compose up -d --build
```

## Catatan

- `Redis` dipakai untuk cache, queue, dan operational event trail ringan.
- `RabbitMQ` dipakai untuk distribusi event antar instance/service.
- `Nginx` saat ini difokuskan sebagai HTTP load balancer dev/local. HTTPS dev self-signed yang lama dilepas dulu agar stack tidak gagal boot karena file sertifikat tidak tersedia.
