FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci --include=dev

COPY . .
RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "dev"]
