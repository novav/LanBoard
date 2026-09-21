import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { CategoryTree } from '@/app/components/CategoryTree';
import { HeroHeader } from '@/app/components/HeroHeader';
import { EmptyState } from '@/app/components/HomeClient';

export const metadata: Metadata = {
  title: 'Home',
};

// 首页依赖数据库(公开分类/链接/站点设置), 必须在请求时渲染。
// 否则 next build 会尝试静态预渲染并连接尚不存在的数据库而失败。
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [categories, setting] = await Promise.all([
    db.category.findMany({
      where: { isPrivate: false },
      orderBy: { path: 'asc' },
      include: {
        links: {
          where: { isPrivate: false },
          orderBy: { sortOrder: 'desc' },
          select: {
            id: true,
            title: true,
            url: true,
            // icon 字段(可能含 1.5MB 的 base64)不在服务端取,
            // 改由 LinkCard 客户端按需 fetch /api/links/{id}/icon
            description: true,
          },
        },
      },
    }),
    db.setting.findUnique({ where: { key: 'site.name' } }).then(
      (r) => r ?? null,
    ),
  ]);

  const siteName = setting?.value ?? 'NavBox';
  const filteredCategories = categories.filter((c) => c.links.length > 0);

  return (
    <div className="flex-1">
      <HeroHeader siteName={siteName} />

      {/* Categories */}
      {filteredCategories.length === 0 ? (
        <EmptyState />
      ) : (
        <CategoryTree categories={filteredCategories} />
      )}
    </div>
  );
}
