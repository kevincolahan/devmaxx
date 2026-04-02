FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/ ./packages/

RUN npm install
RUN cd /app/apps/api && npm install

COPY . .

EXPOSE 3000

CMD ["node", "apps/api/server.js"]
