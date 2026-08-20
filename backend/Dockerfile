FROM node:22-slim

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN npm run build && npm prune --omit=dev

RUN mkdir -p uploads

EXPOSE 5000

CMD ["node", "dist/index.js"]
