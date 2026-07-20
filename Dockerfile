# syntax=docker/dockerfile:1

# ── Stage 1: Compilar o frontend ──────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
ARG REACT_APP_API_URL=/api
ENV REACT_APP_API_URL=$REACT_APP_API_URL
RUN npm run build
# CRA (react-scripts) gera os arquivos estáticos em /app/build

# ── Stage 2: Imagem final — Backend Node.js + Nginx ──────────────────────────
FROM node:20-slim

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001

RUN apt-get update && apt-get install -y \
    nginx supervisor wget \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependências do backend
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY backend/src ./src

# Copiar frontend compilado do stage 1
COPY --from=frontend-builder /app/build /usr/share/nginx/html

# Configuração do nginx
RUN rm -f /etc/nginx/sites-enabled/default
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript image/svg+xml;

    # Sem cache no HTML principal — evita tela branca após deploy
    location = /index.html {
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        expires 0;
    }

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        expires 0;
    }

    # Cache longo para assets com hash no nome (JS, CSS, imagens)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Redireciona chamadas de API para o backend
    location /api/ {
        proxy_pass         http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
        proxy_buffering    off;
    }
}
EOF

# Supervisor — inicia nginx e backend juntos no mesmo container
COPY <<'EOF' /etc/supervisor/conf.d/app.conf
[program:nginx]
command=nginx -g "daemon off;"
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:backend]
command=node src/server.js
directory=/app
autostart=true
autorestart=true
environment=NODE_ENV="production",HOST="0.0.0.0",PORT="3001"
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
EOF

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget -qO- http://127.0.0.1/api/health || exit 1

CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
