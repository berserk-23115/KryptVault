FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# 1. Prune: isolate the server package
FROM base AS builder
WORKDIR /app
RUN npm install -g turbo
COPY . .
# CRITICAL: "server" here must match the "name" inside apps/server/package.json
RUN turbo prune server --docker

# 2. Install & Build
FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/full/tsconfig.base.json ./tsconfig.base.json
RUN pnpm install --frozen-lockfile
COPY --from=builder /app/out/full/ .
RUN pnpm run build --filter=server...

# 3. Run
FROM base AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 honorunner
USER honorunner
COPY --from=installer --chown=honorunner:honorunner /app .

EXPOSE 3000
CMD ["node", "apps/server/dist/index.js"]