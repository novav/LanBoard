// T5 - Admin overview (dashboard landing).
import { db } from "@/lib/db";
import OverviewClient from "./OverviewClient";

// Dashboard reads live DB counts at request time.
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const [categoryCount, linkCount, userCount] = await Promise.all([
    db.category.count(),
    db.link.count(),
    db.user.count(),
  ]);

  return (
    <OverviewClient
      categoryCount={categoryCount}
      linkCount={linkCount}
      userCount={userCount}
    />
  );
}
