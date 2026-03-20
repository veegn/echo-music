FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/qq-music-api/package.json ./packages/qq-music-api/package.json

RUN npm install

COPY . .

RUN npm run build:qqmusic-api
RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
COPY packages/qq-music-api/package.json ./packages/qq-music-api/package.json

RUN npm install --omit=dev

COPY --from=builder /app/server ./server
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/packages/qq-music-api/dist ./packages/qq-music-api/dist

EXPOSE 3000

VOLUME ["/app/server/storage"]

CMD ["npm", "run", "start"]
