// Skeleton for the import page.
export default function ImportLoading() {
  return (
    <div className="space-y-8">
      <div>
        <div className="mb-2 skeleton h-7 w-32" />
        <div className="skeleton h-4 w-64" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card">
            <div className="skeleton mb-4 h-12 w-12 rounded-lg" />
            <div className="mb-2 skeleton h-5 w-2/3" />
            <div className="skeleton mb-2 h-4 w-full" />
            <div className="skeleton mb-4 h-4 w-4/5" />
            <div className="skeleton h-10 w-full" />
          </div>
        ))}
      </div>
      <p className="text-center text-sm text-slate-400">Loading…</p>
    </div>
  );
}
