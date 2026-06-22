# HRMS Enterprise

Enterprise-grade Human Resource Management System (HRMS) with multi-company group structure support.

## Architecture

```
backend/    - Express + TypeScript + Prisma REST API
frontend/   - React + Vite + Tailwind CSS SPA
docker/     - Docker Compose + Nginx configuration
docs/       - Architecture and design documentation
```

## Tech Stack

### Backend
- Node.js + Express + TypeScript
- Prisma ORM + MySQL 8
- Redis + BullMQ
- JWT Authentication with Refresh Token Rotation
- RBAC + ABAC Authorization
- Winston Logger
- Container-ready

### Frontend
- React 19 + Vite + TypeScript
- Zustand State Management
- TanStack Query
- Tailwind CSS + Shadcn UI
- React Router
- Recharts

## Getting Started

### Prerequisites
- Node.js 20+
- Docker & Docker Compose (for MySQL + Redis)
- npm or yarn

### Installation

1. Clone the repository
2. Start infrastructure services:
   ```bash
   docker compose up -d mysql redis
   ```

3. Setup backend:
   ```bash
   cd backend
   cp .env.example .env
   npm install
   npx prisma generate
   npx prisma migrate dev
   npm run prisma:seed
   npm run dev
   ```

4. Setup frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. Open http://localhost:5173

### Default Credentials
- Email: admin@hrms.com
- Password: Admin123!

**Change the default password immediately in production!**

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── config/           # Configuration
│   │   ├── shared/           # Core infrastructure
│   │   │   ├── core/         # Base classes, Result pattern
│   │   │   ├── database/     # Prisma client
│   │   │   ├── security/     # JWT, Password, Rate Limiter
│   │   │   ├── logger/       # Winston logger
│   │   │   ├── middleware/   # Auth, RBAC, Validation
│   │   │   ├── events/       # Event bus
│   │   │   └── exceptions/   # Error hierarchy
│   │   ├── modules/          # Feature modules
│   │   │   ├── auth/         # Authentication
│   │   │   ├── organization/ # Company group structure
│   │   │   ├── rbac/         # Role-based access control
│   │   │   └── user/         # User management
│   │   ├── infrastructure/   # Cache, Mail, Storage
│   │   └── database/         # Migrations, Seeds
│   └── docker/
├── frontend/
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── layouts/          # App shell layouts
│   │   ├── modules/          # Feature pages
│   │   ├── services/         # API services
│   │   ├── stores/           # Zustand stores
│   │   ├── routes/           # Route definitions
│   │   └── utils/            # Utilities
│   └── ...
├── docker/                   # Nginx, MySQL init
└── docs/                     # Architecture docs
```

## Security

- JWT Access Token (15m TTL) + Refresh Token (7d TTL with rotation)
- Password hashing with bcrypt (12 rounds)
- Rate limiting per endpoint and IP
- Helmet security headers
- CORS whitelist
- Input validation via Zod
- RBAC with company/group scoping
- Audit logging for all operations
- Anti-brute-force with account lockout

## License

Proprietary - Bale Inovasi Teknologi
