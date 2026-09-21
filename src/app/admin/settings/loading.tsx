// Skeleton for the settings page.
export default function SettingsLoading() {
  return (
    <div className="space-y-8">
      <div>
        <div className="mb-2 skeleton h-7 w-32" />
        <div className="skeleton h-4 w-72" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card">
            <div className="mb-4 skeleton h-5 w-36" />
            <div className="space-y-4">
              <div className="skeleton h-10 w-full" />
              <div className="skeleton h-10 w-full" />
              <div className="skeleton h-10 w-1/2" />
              <div className="skeleton h-10 w-1/3" />
            </div>
          </div>
        ))}
      </div>
      <p className="text-center text-sm text-slate-400">Loading settings…</p>
    </div>
  );
}
