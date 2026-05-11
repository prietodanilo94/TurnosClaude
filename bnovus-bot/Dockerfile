FROM mcr.microsoft.com/playwright:v1.43.0-jammy

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Solo copiar el código fuente (no node_modules, no .env, no runtime dirs)
COPY src/ ./src/

ENV HEADLESS=true

CMD ["node", "src/test.js"]
