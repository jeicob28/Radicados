# ---------- base ----------
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl
ENV npm_config_update_notifier=false

# ---------- deps (incluye devDependencies para build/prisma) ----------
FROM base AS deps
COPY package.json ./
RUN npm install --no-audit --no-fund

# ---------- dev (hot-reload) ----------
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:dev"]

# ---------- build ----------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# ---------- prod ----------
FROM base AS prod
ENV NODE_ENV=production
# node_modules del stage build: incluye el cliente Prisma ya generado
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
