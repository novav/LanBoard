// T5 - Admin page loading skeleton (shared by route segment).
export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 skeleton h-7 w-48" />
        <div className="skeleton h-4 w-72" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card">
            <div className="skeleton mb-3 h-10 w-10 rounded-lg" />
            <div className="skeleton mb-2 h-7 w-16" />
            <div className="skeleton h-4 w-24" />
          </div>
        ))}
      </div>
      <div className="card">
        <div className="mb-4 skeleton h-4 w-32" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-12 rounded-lg" />
          ))}
        </div>
      </div>
      <p className="text-center text-sm text-slate-400">Loading…</p>
    </div>
  );
}
