FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Standalone Next.js output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma: cliente generado + CLI local (versión pineada en package.json)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/prisma ./prisma

RUN mkdir -p /data && chown nextjs:nodejs /data
VOLUME ["/data"]

USER nextjs
EXPOSE 3014
ENV PORT=3014
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/data/v4.db"

# Aplica schema al SQLite del volumen al iniciar (idempotente)
CMD ["sh", "-c", "node ./node_modules/prisma/build/index.js db push --schema=./prisma/schema.prisma --accept-data-loss --skip-generate && node server.js"]
