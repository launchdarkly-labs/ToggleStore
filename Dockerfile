# Dependencies stage - install all dependencies (including dev) for building
FROM public.ecr.aws/docker/library/node:18-alpine3.18 AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Builder stage - build the Next.js application
FROM public.ecr.aws/docker/library/node:18-alpine3.18 AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Production dependencies stage - install only production dependencies
FROM public.ecr.aws/docker/library/node:18-alpine3.18 AS prod-deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production

# Runner stage - production runtime
FROM public.ecr.aws/docker/library/node:18-alpine3.18 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application and production dependencies
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

USER nextjs

EXPOSE 3000

ENV PORT=3000

CMD ["npm", "start"]

