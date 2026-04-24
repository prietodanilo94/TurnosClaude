FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./package.json
COPY frontend/package.json ./frontend/package.json
COPY tsconfig.json ./tsconfig.json
COPY frontend ./frontend

RUN npm install
RUN npm run build --workspace=frontend

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/static /app/frontend/.next/static

WORKDIR /app/frontend
USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]
