FROM node:20-alpine

WORKDIR /app

# Install dependencies for Prisma and bcrypt
RUN apk add --no-cache openssl

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Runtime must not execute application code as root. The upload volume should
# be provisioned with matching ownership by the deployment platform.
RUN mkdir -p /app/uploads && chown -R node:node /app

USER node

EXPOSE 3000

CMD ["node", "dist/index.js"]
