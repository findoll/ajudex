# AjudeX - Dockerfile para Produção
FROM node:18-alpine

# Definir diretório de trabalho
WORKDIR /app

# Instalar dependências do sistema
RUN apk add --no-cache \
    postgresql-client \
    curl

# copia SSL
COPY . .

# CRIA PATH E CA
RUN mkdir -p /app/certs \
    && curl -o /app/certs/rds-global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem


# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar dependências do Node.js
RUN npm ci --only=production && npm cache clean --force

# Copiar código da aplicação
COPY . .

# Criar diretório de uploads
RUN mkdir -p uploads && chmod 755 uploads

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S ajudex -u 1001
    
# Alterar propriedade dos arquivos
RUN chown -R ajudex:nodejs /app
USER ajudex

# Expor porta
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Comando para iniciar aplicação
CMD ["node", "dev.js"]
