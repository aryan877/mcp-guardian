FROM node:24-alpine AS builder
COPY . /app
WORKDIR /app
RUN npm install && npm run build

FROM node:24-alpine AS release
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/package-lock.json /app/package-lock.json
WORKDIR /app
RUN npm ci --omit=dev
EXPOSE 8080
ENTRYPOINT ["node", "dist/index.js"]
