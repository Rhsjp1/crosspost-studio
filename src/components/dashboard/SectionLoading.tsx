export default function SectionLoading() {
  return (
    <div className="space-y-4 p-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-9 w-32" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card">
            <div className="skeleton mb-3 h-4 w-24" />
            <div className="skeleton mb-2 h-8 w-16" />
            <div className="skeleton h-3 w-32" />
          </div>
        ))}
      </div>

      {/* Table / list skeleton */}
      <div className="card mt-6">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="skeleton h-4 w-4 shrink-0 rounded-full" />
              <div className="skeleton h-4 w-1/3" />
              <div className="skeleton h-4 w-1/4" />
              <div className="ml-auto skeleton h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Second row skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card">
          <div className="skeleton mb-4 h-5 w-32" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-4 w-full" />
            ))}
          </div>
        </div>
        <div className="card">
          <div className="skeleton mb-4 h-5 w-32" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-4 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
