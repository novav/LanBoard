// Skeleton for the categories page.
export default function CategoriesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="mb-2 skeleton h-7 w-36" />
          <div className="skeleton h-4 w-64" />
        </div>
        <div className="skeleton h-10 w-32" />
      </div>
      <div className="card overflow-hidden">
        <div className="skeleton h-14 w-full" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 border-t border-slate-200 p-4 dark:border-slate-700">
            <div className="skeleton h-8 w-8 rounded" />
            <div className="skeleton h-4 w-12" />
            <div className="flex-1 skeleton h-4 w-24" />
            <div className="skeleton h-4 w-16" />
            <div className="skeleton h-4 w-20" />
            <div className="skeleton h-4 w-10" />
            <div className="skeleton h-8 w-20" />
          </div>
        ))}
      </div>
      <p className="text-center text-sm text-slate-400">Loading categories…</p>
    </div>
  );
}
