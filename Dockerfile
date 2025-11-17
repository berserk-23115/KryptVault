FROM node:22-alpine

WORKDIR /app

RUN npm install -g pnpm

COPY package*json tsconfig*json ./

RUN pnpm install

COPY . .

RUN pnpm build

EXPOSE 3000

WORKDIR /app/apps/server
CMD ["pnpm", "start"]
