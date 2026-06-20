FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY apps/server-standalone/package.json ./apps/server-standalone/

# Install dependencies
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Build stage
FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server-standalone/node_modules ./apps/server-standalone/node_modules

# Copy source files
COPY apps/server-standalone ./apps/server-standalone
COPY apps/server ./apps/server
COPY packages ./packages
COPY src ./src
COPY tsconfig.json ./

# Build the standalone server
WORKDIR /app/apps/server-standalone
RUN npm run build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3210

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 serveruser

# Copy built files
COPY --from=builder --chown=serveruser:nodejs /app/apps/server-standalone/dist ./dist
COPY --from=builder --chown=serveruser:nodejs /app/apps/server-standalone/package.json ./

# Install production dependencies only
RUN corepack enable pnpm && pnpm install --prod --frozen-lockfile

USER serveruser

EXPOSE 3210

CMD ["node", "dist/index.js"]
