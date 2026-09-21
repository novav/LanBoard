export default function Loading() {
  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-12">
      <div className="flex items-center justify-center py-8">
        <span className="inline-flex h-6 w-6 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-4 flex items-center gap-4">
          <div className="skeleton h-12 w-12 rounded-xl" />
          <div className="flex-1">
            <div className="skeleton mb-2 h-5 w-1/3" />
            <div className="skeleton h-4 w-1/2" />
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card">
              <div className="skeleton mb-3 h-10 w-10" />
              <div className="skeleton mb-2 h-4 w-1/2" />
              <div className="skeleton h-3 w-3/4" />
              <div className="mt-2 h-px bg-slate-100" />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="skeleton h-9" />
                <div className="skeleton h-9" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="text-center text-sm text-slate-400">Loading…</p>
    </section>
  );
}
