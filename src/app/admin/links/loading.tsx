// Skeleton for the links page.
export default function LinksLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="mb-2 skeleton h-7 w-28" />
          <div className="skeleton h-4 w-56" />
        </div>
        <div className="skeleton h-10 w-28" />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="skeleton h-10 w-64" />
        <div className="skeleton h-10 w-40" />
        <div className="skeleton h-10 w-32" />
      </div>
      <div className="card overflow-hidden">
        <div className="skeleton h-12 w-full" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="grid grid-cols-12 gap-3 border-t border-slate-200 p-4 dark:border-slate-700"
          >
            <div className="col-span-2 skeleton h-4 w-28" />
            <div className="col-span-2 skeleton h-4 w-20" />
            <div className="skeleton h-4 w-14" />
            <div className="skeleton h-4 w-12" />
            <div className="skeleton h-4 w-10" />
            <div className="skeleton h-4 w-10" />
            <div className="col-span-1 flex gap-2">
              <div className="skeleton h-8 w-14" />
              <div className="skeleton h-8 w-14" />
            </div>
          </div>
        ))}
      </div>
      <p className="text-center text-sm text-slate-400">Loading links…</p>
    </div>
  );
}
