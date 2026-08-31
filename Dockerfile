# syntax=docker/dockerfile:1.6
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

# Shared base for both final images. libreoffice is NOT installed here — it's
# only needed by the app's /api/contracts/[id]/pdf DOCX→PDF conversion, never
# by the worker (scripts/worker.js just runs scheduled DB jobs). Adding it as
# its own layer on the "runner" stage below (not here) means `docker compose
# build app worker` only pays the (large) libreoffice install once, instead
# of duplicating it into both service images.
FROM node:20-alpine AS runner-base
RUN apk add --no-cache libc6-compat openssl su-exec
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY --chown=nextjs:nodejs scripts/entrypoint.sh /app/entrypoint.sh
COPY --chown=nextjs:nodejs scripts/worker.js /app/scripts/worker.js
RUN chmod +x /app/entrypoint.sh

# Runs as root so the entrypoint can chown bind-mounted /app/storage,
# then drops to the nextjs user via su-exec.
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["/app/entrypoint.sh"]

FROM runner-base AS worker

FROM runner-base AS runner
# libreoffice + fonts: used by /api/contracts/[id]/pdf to convert generated
# DOCX → PDF for in-app preview/print/share.
RUN apk add --no-cache libreoffice ttf-dejavu fontconfig
