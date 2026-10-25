# XHCMS Novel 2.0 —— 单镜像（API + Web）Dockerfile
# 构建：docker build -t xhcms-novel:2.0.0 .
# 运行：docker compose up -d --build（推荐，见 docker-compose.yml）

# ---------- 构建阶段 ----------
FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /app

# 先复制依赖清单，充分利用层缓存
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/api/nest-cli.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/api/prisma apps/api/prisma

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @wmcms/api exec prisma generate

COPY . .

# 前端 API 地址在构建期写入（浏览器访问地址）
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm build:shared \
 && pnpm --filter @wmcms/api build \
 && pnpm --filter @wmcms/web build

# ---------- 运行阶段 ----------
FROM node:22-bookworm-slim AS runtime
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /app

# 单镜像包含构建产物与生产依赖（自托管部署优先简单可靠）
COPY --from=build /app /app
COPY deploy/docker-entrypoint.sh /usr/local/bin/xhcms-entrypoint
RUN chmod +x /usr/local/bin/xhcms-entrypoint \
 && mkdir -p /data/uploads

VOLUME ["/data"]
EXPOSE 3000 4000

# 入口会执行 prisma db push（可选 SEED_DEMO=1 写入演示数据），随后同时启动 API 与 Web
ENTRYPOINT ["/usr/local/bin/xhcms-entrypoint"]
