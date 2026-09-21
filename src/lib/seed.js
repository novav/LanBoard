/**
 * NavBox 数据库种子脚本（兜底管理员 + 默认站点设置）
 *
 * 用法:
 *   npx prisma db seed        (由 package.json 中 prisma.seed 配置驱动)
 *   或 node src/lib/seed.js
 *
 * 环境变量:
 *   DATABASE_URL   SQLite 路径, 如 file:./prisma/dev.db
 *   ADMIN_USERNAME 默认 "admin"
 *   ADMIN_PASSWORD 运行时传入(必填), 避免明文凭证进入版本控制。
 *
 * 设计说明(与原 PRD "admin / admin123" 兜底对齐):
 *   - 种子在 /setup 向导之后运行, 作为兜底: 若 User 已存在则跳过。
 *   - 默认密码由运行时的 ADMIN_PASSWORD 环境变量提供; 部署时由
 *     docker-compose / 启动脚本注入, 不写入源代码。
 *   - 密码以 bcrypt (salt 10) 哈希后存储。
 */

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  console.error(
    "未设置管理员密码。请通过环境变量 ADMIN_PASSWORD 传入。" +
      "示例: ADMIN_PASSWORD=<strong-password> npm run prisma:seed",
  );
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findFirst();
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  if (existing) {
    // 管理员已存在: 覆盖密码, 方便部署时通过 .env 统一管理。
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash },
    });
    console.log(`已更新管理员账号密码: ${existing.username}`);
  } else {
    await prisma.user.create({
      data: {
        username: ADMIN_USERNAME,
        passwordHash,
      },
    });
    console.log(`已创建管理员账号: ${ADMIN_USERNAME}`);
  }

  const defaults = [
    { key: "site.name", value: "NavBox" },
    { key: "site.timezone", value: "UTC" },
    { key: "site.language", value: "zh-CN" },
    {
      key: "searchEngines",
      value: JSON.stringify([
        { name: "Baidu", url: "https://www.baidu.com/s?wd={query}" },
        { name: "Google", url: "https://www.google.com/search?q={query}" },
      ]),
    },
  ];

  for (const d of defaults) {
    await prisma.setting.upsert({
      where: { key: d.key },
      update: {},
      create: { key: d.key, value: d.value },
    });
  }
  console.log("默认站点设置已写入。");
}

main()
  .catch(async (e) => {
    console.error("种子失败:", e);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
