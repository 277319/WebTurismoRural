# --- Desarrollo: servidor de Vite con recarga en caliente ---
FROM node:22-slim AS dev
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# --- Build de producción ---
FROM dev AS build
RUN npm run build

# --- Producción: nginx sirve los estáticos y redirige /api al backend ---
FROM nginx:1.29-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
