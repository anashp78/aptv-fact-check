FROM oven/bun:1.4-alpine AS build

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src/ src/
COPY tsconfig.json drizzle.config.ts ./
COPY drizzle/ drizzle/

FROM oven/bun:1.4-alpine
WORKDIR /app
COPY --from=build /app ./

EXPOSE 3100
ENV PORT=3100
ENV NODE_ENV=production

CMD ["bun", "src/index.ts"]
