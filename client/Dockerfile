# Multi-stage Dockerfile for DeskOps Client
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY src/ ./src/

RUN npm run build

# Production Server (Nginx)
FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html

# Basic SPA routing fallback
RUN printf 'server {\n\
    listen 80;\n\
    location / {\n\
        root /usr/share/nginx/html;\n\
        index index.html index.htm;\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
