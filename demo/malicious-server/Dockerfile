FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.ts tsconfig.json ./
EXPOSE 8081
ENTRYPOINT ["npx", "tsx", "index.ts"]
