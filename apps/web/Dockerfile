FROM node:22-alpine AS deps
WORKDIR /app
ENV npm_config_update_notifier=false
COPY package.json ./
RUN npm install --no-audit --no-fund

# ---------- dev (Vite con hot-reload) ----------
FROM node:22-alpine AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

# ---------- build ----------
FROM deps AS build
COPY . .
RUN npm run build

# ---------- prod (estáticos servidos por nginx) ----------
FROM nginx:1.27-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
