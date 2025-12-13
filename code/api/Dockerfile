FROM oven/bun:1 as base
WORKDIR /usr/src/app

# Copy root package files
COPY package.json bun.lock ./

# Copy workspace package files (all needed to satisfy workspace resolution)
COPY api/package.json api/
COPY shared/package.json shared/
COPY mobile/package.json mobile/
COPY web/package.json web/

# Install dependencies, skipping optional peers (like better-sqlite3)
RUN bun install --frozen-lockfile --no-optional

# Copy source code for api and shared
COPY shared shared/
COPY api api/

# Set working directory to api
WORKDIR /usr/src/app/api

# Expose port
EXPOSE 3000

# Start command
CMD ["bun", "run", "src/index.ts"]
