# Manager API image.
FROM node:22-alpine AS base
WORKDIR /app

# Install workspace deps (root + api) using the lockfile for reproducibility.
FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
RUN npm install --workspace apps/api --omit=dev

FROM base AS build
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
RUN npm install --workspace apps/api
COPY tsconfig.base.json ./
COPY apps/api ./apps/api
RUN npm run build --workspace apps/api

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY apps/api/migrations ./apps/api/migrations
COPY apps/api/package.json ./apps/api/package.json
EXPOSE 4000
CMD ["node", "apps/api/dist/index.js"]
