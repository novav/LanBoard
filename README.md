# NavBox

NavBox 是一款自托管的 NAS / 私有导航站，参考 OneNav 的产品形态，面向个人或小团队，用于集中管理和展示常用链接与内部服务入口。单容器 Docker 部署，数据落地 SQLite，无外部依赖。

技术栈：Next.js 14 (App Router) + TypeScript + Tailwind CSS + Prisma / SQLite。

[简体中文 README](README.md) · [English README](README.en.md)

## 截图

![NavBox 首页](home.png)

---

## 目录

- [截图](#截图)
- [特性](#特性)
- [快速开始](#快速开始)
- [首次使用](#首次使用)
- [环境变量](#环境变量)
- [可选功能配置](#可选功能配置)
  - [启用 Docker 容器扫描](#启用-docker-容器扫描)
  - [启用 Nginx 站点扫描](#启用-nginx-站点扫描)
- [本地开发](#本地开发)
- [数据库迁移](#数据库迁移)
- [安全注意事项](#安全注意事项)
- [文件结构](#文件结构)
- [常见问题](#常见问题)

---

## 特性

- **单管理员**：系统仅支持一个管理员账号，通过首次启动向导创建，Session 基于 HttpOnly Cookie。
- **分类 / 链接管理**：增删改分类与链接，支持拖拽排序、私密项控制、点击计数。
- **导入 / 导出**：
  - 浏览器书签导入（Chrome / Edge / Firefox / Safari 的 Netscape Bookmark HTML）。
  - JSON 导入 / 导出（兼容 OneNav 导出格式，用于备份与迁移）。
  - Docker 容器扫描导入（读取运行中容器，按端口 / Label 批量导入）。
  - Nginx 站点扫描导入（解析 `server` 块，批量识别已有站点）。
- **Favicon**：新增链接自动抓取网站 favicon，抓取失败时支持手动上传或填写图标 URL，可批量触发。
- **搜索**：本地链接实时过滤 + 可配置的外部搜索引擎回退（Google / Bing / 百度等）。
- **深色 / 浅色主题**：自动跟随系统，可手动切换，偏好通过 `localStorage` 持久化。
- **响应式**：适配桌面、平板与手机。
- **安全**：登录限流（滑动窗口）、密码 bcrypt 哈希、私密内容服务端过滤、文件上传类型 / 大小校验。

---

## 快速开始

确保宿主机已安装 [Docker](https://docs.docker.com/get-docker/) 和 [Docker Compose](https://docs.docker.com/compose/)。

### 1. 克隆项目

```bash
git clone https://github.com/your-username/NavBox.git
cd NavBox
```

### 2. 准备启动脚本

将仓库根目录的 `docker-compose.yml` 复制为 `docker-compose.override.yml`（或直接修改 `docker-compose.yml`）以注入管理员密码：

```yaml
# docker-compose.override.yml
services:
  navbox:
    environment:
      - ADMIN_USERNAME=admin
      - ADMIN_PASSWORD=YourStrongPassword123
```

> **`ADMIN_PASSWORD` 必须在首次启动时设置**，它将用于兜底创建管理员账号。务必使用强密码，切勿使用默认弱口令。

### 3. 一键启动

```bash
docker compose up -d
```

启动时容器会自动执行数据库迁移与种子脚本。随后浏览器访问（见下方「首次使用」）。

### 4. docker-compose 参考

若仓库尚未包含 `docker-compose.yml`，标准结构如下（**docker.sock 与 nginx conf 挂载默认注释，按需启用**）：

```yaml
# docker-compose.yml
services:
  navbox:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: navbox
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=file:/app/data/navbox.db
      - ADMIN_USERNAME=admin
      # - ADMIN_PASSWORD=YourStrongPassword123   # 首次启动时设置
    volumes:
      - ./data:/data           # SQLite 数据库持久化
      - ./uploads:/app/uploads # 手动上传的图标文件持久化
    # 可选: 启用 Docker 容器扫描 —— 详见下方风险提示
    # volumes:
    #   - /var/run/docker.sock:/var/run/docker.sock:ro
    # 可选: 启用 Nginx 站点扫描
    # volumes:
    #   - /etc/nginx:/etc/nginx:ro

# 多阶段 Dockerfile (Dockerfile)
# FROM node:20-alpine AS deps
# COPY package.json package-lock.json ./
# RUN npm ci
#
# FROM node:20-alpine AS builder
# COPY . .
# RUN npm run build
#
# FROM node:20-alpine AS runner
# WORKDIR /app
# ENV NODE_ENV=production
# EXPOSE 3000
# COPY --from=builder /app/standalone ./
# COPY --from=builder /app/public ./public
# COPY --from=builder /app/prisma ./prisma
# COPY --from=builder /app/package.json ./
# RUN npm install --omit=dev @prisma/client
# CMD ["node", "server.js"]
```

---

## 首次使用

1. 访问 `http://<NAS-IP>:3000`。
2. **首次访问会自动跳转到 `/setup` 向导**（当数据库中尚无管理员时）。
3. 在 `/setup` 页面填写用户名与密码，完成管理员初始化。
   - 密码以 bcrypt 哈希存储，不会明文保存。
   - 初始化完成后，`Setting.setupCompleted = true`，之后无法再次进入 `/setup`。
4. 登录后可进入 `/admin` 后台进行站点配置、添加分类与链接。
5. 未登录时，首页仅展示公开（`isPrivate = false`）的分类与链接，搜索功能仍可用。

> 若已在 `docker-compose` 中设置了 `ADMIN_PASSWORD`，种子脚本会在数据库首次初始化时自动创建管理员账号，`/setup` 可跳过。

---

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `DATABASE_URL` | 是 | `file:/app/data/navbox.db` | SQLite 数据库路径，指向持久化 volume |
| `ADMIN_USERNAME` | 否 | `admin` | 管理员用户名 |
| `ADMIN_PASSWORD` | 建议 | 无 | 管理员密码（运行时注入，不进入源码）；未设置时只能通过 `/setup` 创建 |
| `DOCKER_GID` | Docker扫描 | `999` | Docker 组 GID，用于容器访问 Docker socket；Linux 通过 `getent group docker` 获取 |
| `NODE_ENV` | 否 | `production` | 运行环境 |
| `PORT` | 否 | `3000` | Next.js 监听端口 |

> 敏感变量（`ADMIN_PASSWORD`）请通过 `docker-compose` 的 `environment`、`.env` 文件（已加入 `.gitignore`）或 Docker `--env` 注入，切勿硬编码进仓库。

---

## 可选功能配置

NavBox 部分功能需要访问宿主机的 Docker 或 Nginx 资源，需通过 **只读挂载** 实现。这些挂载**默认关闭**，按需在 `docker-compose.yml` 中启用。

### 启用 Docker 容器扫描

> ⚠️ **安全警告（重要）**
>
> 挂载 `docker.sock` 等价于赋予容器 **近乎宿主机 root 级别的权限**：容器可以读取所有容器信息，若挂载未限制为只读，甚至可操控、销毁宿主机上的其他容器。
>
> - 此功能 **默认关闭**，且需在后台「设置」中手动开启。
> - **仅在完全信任的私有 NAS / Homelab 环境中启用**，切勿在面向公网或不可信环境中开启。
> - 始终使用 `:ro` 只读挂载，并仅在导入时临时启用，导入完成后移除挂载。

启用步骤：

1. **获取 Docker 组 GID**（Linux 环境）：

   ```bash
   getent group docker | cut -d: -f3
   ```

   输出示例：`981`（Windows/Mac Docker Desktop 通常为 `999`）

2. **配置 `.env` 文件**：

   ```bash
   # 复制模板（如果还没有 .env）
   cp .env.example .env
   
   # 编辑 .env，添加或修改：
   DOCKER_GID=981  # 替换为上一步获取的实际 GID
   ```

3. **在 `docker-compose.yml` 中取消注释 docker.sock 挂载**（**务必 `:ro` 只读**）：

   ```yaml
   volumes:
     - /var/run/docker.sock:/var/run/docker.sock:ro
   ```

   > 📘 `docker-compose.yml` 已包含 `group_add: ["${DOCKER_GID:-999}"]` 配置，会自动将容器用户加入 Docker 组以访问 socket。

4. **重启容器**：

   ```bash
   docker compose down
   docker compose up -d
   ```

5. 进入 `/admin/import/docker`，点击「Scan Docker Containers」，按预览结果勾选后批量导入。

**容器 Label 支持**（可选，用于精确控制导入信息）：

| Label | 说明 |
|-------|------|
| `navbox.enable=false` | 扫描时排除该容器 |
| `navbox.name` | 覆盖显示名称 |
| `navbox.icon` | 覆盖图标 URL |
| `navbox.category` | 指定归属分类（不存在则新建） |
| `navbox.url` | 覆盖完整访问地址 |

**生成链接地址规则**：`http://<NAS_HOST>:<PublicPort>`。`NAS_HOST` 需在「设置」中配置为 NAS 的局域网 IP / 域名（容器内无法自动获取宿主机对外地址）。

---

### 启用 Nginx 站点扫描

> 📘 Nginx 配置挂载为 **只读**，仅静态解析 conf 文件，不涉及 Nginx 运行时，**风险远低于 docker.sock 挂载**。建议在运行 Nginx 的同一台机器上部署 NavBox，或通过只读挂载将 Nginx 配置目录传入容器。

启用步骤：

1. 在 `docker-compose.yml` 中取消注释 nginx conf 挂载（**`:ro` 只读**）：

   ```yaml
   volumes:
     - /etc/nginx:/etc/nginx:ro
   ```

2. 重启容器：`docker compose up -d`
3. 进入 `/admin` → 站点设置，设置「Nginx config directory」（字段 `nginx:confPath`，默认 `/etc/nginx`，可自定义）。
4. 在「导入」页面点击「扫描 Nginx 站点」，按预览结果勾选后批量导入。

**解析逻辑说明**：

- 递归展开 `include` 指令（最多 3 层），合并 `conf.d/*.conf` 等多文件结构。
- 按 `server { ... }` 块分割，每个 block 视为一个站点。
- 提取字段：`server_name`（标题）、`listen` 端口与 `ssl_certificate`（协议）、`location → proxy_pass`（目标地址）。
- **URL 推断优先级**：`proxy_pass` 实际地址 > `server_name` + `listen` 端口拼接。
- 识别常见服务名称映射图标（jellyfin / qbittorrent / admin 等）。
- **upstream 解析**：自动将 `proxy_pass http://upstream_name` 中的 upstream 名称替换为实际地址。
- **变量占位符降级**：`proxy_pass` 含 `$host` / `${var}` 等 Nginx 变量时，自动回退到 `server_name + 端口`，并在预览中标注「含变量，已回退」。

**私有域名处理**：导入时提供「域名解析模式」选项：
- **保留原域名**：需自行配 hosts / 本地 DNS。
- **替换为 NAS_HOST 模式**（推荐）：`jellyfin.local` + NAS_HOST `192.168.1.100` → `http://192.168.1.100/jellyfin`，更通用。

---

## 本地开发

适用于本地调试与二次开发。

### 1. 安装依赖

```bash
npm install
```

### 2. 创建数据库并生成 Prisma 客户端

```bash
npm run db:push
npm run db:generate
```

### 3. 设置环境变量

在项目根目录创建 `.env` 文件（已加入 `.gitignore`）：

```env
DATABASE_URL="file:./prisma/dev.db"
ADMIN_PASSWORD="YourStrongPassword123"
```

### 4. 运行种子脚本

```bash
npm run prisma:seed
```

### 5. 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:3000`。

### 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建 |
| `npm run start` | 启动生产服务 |
| `npm run db:generate` | 生成 Prisma Client |
| `npm run db:push` | 推送 Schema 到数据库 |
| `npm run prisma:seed` | 运行种子脚本 |
| `npm run prisma:studio` | 打开 Prisma Studio（可视化数据库） |

---

## 数据库迁移

NavBox 使用 Prisma 管理数据库 Schema。

### 创建新迁移（开发阶段）

修改 `prisma/schema.prisma` 后运行：

```bash
npm run prisma:migrate
```

生成迁移文件后提交到版本控制。

### 在容器内自动执行

生产容器启动时自动运行 `prisma migrate deploy`，无需手动操作。如需手动执行：

```bash
docker compose exec navbox npx prisma migrate deploy
```

### 本地重置数据库

```bash
npx prisma migrate reset
npm run prisma:seed
```

---

## 安全注意事项

### ⚠️ docker.sock 挂载风险（再次强调）

挂载 `docker.sock` 是最敏感的配置项，请牢记：

1. **权限等同宿主机 root**：挂载 socket 使容器可通过 Docker Engine API 执行任意 Docker 操作。
2. **务必只读挂载**：始终使用 `:ro` 标志，限制容器只能读取容器列表与端口信息。
3. **仅在受信任环境启用**：私有 NAS / Homelab 内部网络，切勿对外暴露。
4. **按需临时启用**：在「设置」中手动开启，导入完成后关闭并移除挂载。
5. **生产 / 公网环境禁用**：任何面向公网的部署都不应启用此功能。

### 其他安全建议

- **管理员密码**：使用强密码（12 位以上，大小写 + 数字 + 符号），避免弱口令。
- **反向代理**：建议通过 Nginx / Caddy 反向代理访问 NavBox，启用 HTTPS，防止密码与 Cookie 明文传输。
- **数据持久化**：务必持久化 `data`（SQLite）和 `uploads`（图标）目录，否则容器重建会丢失数据。
- **访问控制**：如非必要，将端口绑定到内网地址（如 `127.0.0.1:3000`）而非 `0.0.0.0`。

---

## 文件结构

```
├── Dockerfile                  # 多阶段构建（dev → build → runner）
├── docker-compose.yml          # Docker Compose 编排（含可选挂载说明）
├── next.config.js              # Next.js 配置（output: standalone）
├── package.json                # 依赖与脚本
├── prisma
│   └── schema.prisma           # 数据库 Schema
├── src
│   ├── app                     # Next.js App Router 页面与 API
│   │   ├── api                 # API Routes（auth / categories / links / settings / import / scan）
│   │   ├── admin               # 后台管理页面
│   │   └── setup               # 首次启动向导
│   └── lib                     # 工具库（db / auth / nginx-parser / bookmark-parser）
└── uploads/                    # 手动上传的图标（运行时目录，持久化至 volume）
```

---

## 常见问题

**Q: 忘记管理员密码怎么办？**

A: 停止容器，删除 `data/db.sqlite` 后重新启动，重新进入 `/setup` 向导。注意这会清空所有数据。

**Q: Docker 扫描显示 "Access denied to Docker socket"？**

A: 这是权限问题。解决方法：
1. 确认 `docker-compose.yml` 中已挂载 socket（`:ro` 只读）
2. 获取 Docker 组 GID：`getent group docker | cut -d: -f3`
3. 在 `.env` 中设置 `DOCKER_GID=<实际GID>`
4. 重启容器：`docker compose down && docker compose up -d`

**Q: Docker 扫描找不到我的容器？**

A: 确认容器正在运行且暴露了端口映射；在「设置」中填写 NAS 局域网地址用于生成访问链接。

**Q: Nginx 扫描显示配置目录不存在？**

A: 确认 nginx conf 目录已挂载；在「设置」中核对 `nginx:confPath`；NavBox 需运行在与 Nginx 同一台机器上，或已挂载配置目录。

**Q: 如何备份数据？**

A: 使用后台「导入 / 导出」导出 JSON 备份全部数据，同时备份 `data/`（SQLite）和 `uploads/`（图标）目录。
