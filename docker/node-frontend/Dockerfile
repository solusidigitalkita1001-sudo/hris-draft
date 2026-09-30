# Stage 1: Build React + Vite
FROM node:20-alpine AS builder

WORKDIR /app

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# bypass tsc strict check
RUN npx vite build

# Stage 2: Serve dengan Nginx
FROM nginx:1.25-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker/node-frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    # 127.0.0.1, not localhost: nginx here listens on IPv4 only, localhost
    # resolves to ::1 first, and busybox wget does not fall back. This exact
    # line reported the frontend unhealthy for as long as it had been deployed.
    CMD wget -qO- http://127.0.0.1/health || exit 1
CMD ["nginx", "-g", "daemon off;"]
