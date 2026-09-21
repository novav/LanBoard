# =============================================================================
# NavBox - 三阶段 Dockerfile
# Stage 1: builder       (安装全量依赖 -> Prisma generate -> Next.js build)
# Stage 2: runtime-deps  (仅装 production 依赖,独立缓存层,COPY 快)
# Stage 3: runtime       (轻量镜像,仅包含 standalone 产物 + runtime 依赖)
#
# 使用 node:20-bullseye (Debian 11, 自带 OpenSSL 1.1.1) 而非 node:20-slim
# (Debian 12 用 OpenSSL 3.x)，因为 Prisma 6.x engine 依赖 OpenSSL 1.1.x。
# =============================================================================

# ---------------- Stage 1: builder -----------------------------------------
FROM node:20-bullseye AS builder

WORKDIR /app

# 先复制 package/lock 文件, 利用 Docker 层缓存
COPY package.json package-lock.json* ./

# 安装全部依赖(含 devDependencies, 构建需要)
RUN npm install

# 复制源码
COPY . .

# 使用国内镜像加速 Prisma Engine 下载(默认官方服务器在国外, 慢)
ENV PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/prisma-engines

# 生成 Prisma Client + 构建 Next.js, 合为一层提升缓存稳定性
RUN npx prisma generate && npm run build

# ---------------- Stage 2: runtime-deps -------------------------------------
# 从基础镜像重新安装,只装 production 依赖
# 独立于 builder,这样 COPY 的是一整层而非从 builder 里挑文件
FROM node:20-bullseye AS runtime-deps

WORKDIR /app
COPY --from=builder /app/package.json ./
RUN npm install --omit=dev --ignore-scripts

# ---------------- Stage 3: runtime -----------------------------------------
FROM node:20-bullseye

WORKDIR /app

# 运行时以 appuser 运行(安全), 非 root
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --shell /bin/sh --create-home appuser

# 复制 standalone 构建产物
COPY --from=builder --chown=appuser:appgroup /app/.next/standalone ./

# standalone 产物不包含 .next/static, 需单独复制
RUN mkdir -p .next
COPY --from=builder --chown=appuser:appgroup /app/.next/static .next/static

# 复制 public/ 目录(Next.js standalone 服务器从 public/ 提供静态文件, 如 /favicon.svg)
COPY --from=builder --chown=appuser:appgroup /app/public ./public

# 复制 Prisma schema(供运行时 migrate deploy 使用)
COPY --from=builder --chown=appuser:appgroup /app/prisma ./prisma

# 复制种子脚本(standalone 产物不含 src/, 需单独复制供 prisma db seed 使用)
COPY --from=builder --chown=appuser:appgroup /app/src/lib/seed.js ./src/lib/seed.js

# 复制 package.json
COPY --from=builder --chown=appuser:appgroup /app/package.json ./

# 复制 production-only 的 node_modules(从 runtime-deps 阶段拷贝,体积小)
COPY --from=runtime-deps --chown=appuser:appgroup /app/node_modules ./node_modules

# 创建数据挂载目录(由 docker-compose volume 持久化)
RUN mkdir -p /app/data /app/uploads && \
    chown -R appuser:appgroup /app/data /app/uploads

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# 启动: 先迁移数据库(幂等, 无变更时秒过), 可选种子, 再启动服务
#   - 用 root 执行 migrate/seed, 保证对挂载 volume 的读写权限
#   - 启动前 chmod 777 volume 目录(挂载点权限由宿主目录决定)
#   - 用 su -s /bin/sh - appuser 降级权限启动服务(POSIX 通用, 无需额外包)
USER root

ENTRYPOINT ["sh", "-c", \
    "chmod -R 777 /app/data /app/uploads 2>/dev/null || true; \
     if [ -S /var/run/docker.sock ]; then \
       SOCK_GID=$(stat -c '%g' /var/run/docker.sock); \
       getent group $SOCK_GID >/dev/null || groupadd -g $SOCK_GID dockergroup; \
       usermod -aG $SOCK_GID appuser; \
     fi; \
     npx prisma migrate deploy; \
     if [ -n \"$ADMIN_PASSWORD\" ]; then npx prisma db seed || true; fi; \
     exec su -s /bin/sh appuser -c \"cd /app && exec node server.js\""]