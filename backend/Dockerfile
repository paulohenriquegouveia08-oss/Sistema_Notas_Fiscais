FROM node:20-alpine

WORKDIR /app

# Instalar dependências
COPY package*.json ./
RUN npm ci

# Copiar código fonte
COPY . .

# Build do projeto
RUN npm run build

EXPOSE 3001

# Comando de inicialização
CMD ["npm", "run", "start:prod"]
