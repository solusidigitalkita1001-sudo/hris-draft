# Stage 1: Build TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

COPY backend/package*.json ./
RUN npm install

COPY backend/ .

# Generate Prisma client dengan schema di lokasi custom
RUN npx prisma generate --schema=src/database/prisma/schema.prisma

RUN npm run build

# Stage 2: Production
FROM node:20-alpine

RUN apk add --no-cache curl openssl openssl-dev

WORKDIR /app

COPY --from=builder /app/dist              ./dist
COPY --from=builder /app/node_modules      ./node_modules
COPY --from=builder /app/package*.json     ./

# Copy prisma schema sesuai lokasi custom
COPY --from=builder /app/src/database/prisma ./src/database/prisma

# Regenerate Prisma client di production
RUN npx prisma generate --schema=src/database/prisma/schema.prisma

EXPOSE 3000

# curl does fall back from ::1 to IPv4, so localhost worked here - but being
# explicit costs nothing and removes the dependence on that behaviour.
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://127.0.0.1:3000/health || exit 1

CMD ["node", "dist/index.js"]
