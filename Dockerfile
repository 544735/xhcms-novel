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

# 兜底清理：.dockerignore 已排除环境变量文件，这里再删一次，避免本地 .env 被打进镜像层
RUN rm -f apps/api/.env apps/web/.env.local

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

# 镜像级健康检查：探测 API 健康端点（Web 的就绪由入口脚本的启动顺序保证）
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# 安全说明：镜像当前以 root 运行，因为 /data 命名卷默认由 root 拥有、入口脚本需要写上传目录并连接 PostgreSQL 服务。
# 生产建议另建非 root 用户：先 chown 卷目录（或改用已授权的 bind mount），再在运行阶段加 USER app。

# 入口会执行 prisma migrate deploy（可选 SEED_DEMO=1 写入演示数据），随后同时启动 API 与 Web
ENTRYPOINT ["/usr/local/bin/xhcms-entrypoint"]
