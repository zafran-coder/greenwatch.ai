import { Card } from "./ui";

export function Skeleton({ className = "" }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-slate-200/80 ${className}`}
      aria-hidden="true"
    />
  );
}

export function StatCardSkeleton() {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between">
        <Skeleton className="size-10 rounded-xl" />
        <Skeleton className="h-4 w-12 rounded-full" />
      </div>
      <div className="mt-3">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="mt-1.5 h-3.5 w-24" />
      </div>
    </Card>
  );
}

export function StatCardsGroupSkeleton() {
  return (
    <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <tr className="border-b border-slate-100 last:border-b-0">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-lg" />
          <div>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-1 h-3 w-16" />
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-1 h-3 w-20" />
      </td>
      <td className="px-5 py-3.5">
        <Skeleton className="h-5 w-20 rounded-full" />
      </td>
      <td className="px-5 py-3.5">
        <Skeleton className="h-5 w-16 rounded-full" />
      </td>
      <td className="px-5 py-3.5">
        <Skeleton className="h-4 w-24" />
      </td>
      <td className="px-5 py-3.5">
        <Skeleton className="h-4 w-16" />
      </td>
    </tr>
  );
}

export function ReportTableSkeleton({ rows = 6 }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-100 bg-slate-50/75 text-xs uppercase tracking-wider text-slate-400">
          <tr>
            <th className="px-5 py-3 font-medium">Issue</th>
            <th className="px-5 py-3 font-medium">Location</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium">Priority</th>
            <th className="px-5 py-3 font-medium">Department</th>
            <th className="px-5 py-3 font-medium">Due Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ChartSkeleton({ height = 230 }) {
  return (
    <div
      style={{ height }}
      className="flex w-full items-end justify-between gap-3 px-4 pb-4 pt-8"
      aria-hidden="true"
    >
      <Skeleton className="h-1/3 flex-1 rounded-t-md" />
      <Skeleton className="h-2/3 flex-1 rounded-t-md" />
      <Skeleton className="h-1/2 flex-1 rounded-t-md" />
      <Skeleton className="h-4/5 flex-1 rounded-t-md" />
      <Skeleton className="h-3/5 flex-1 rounded-t-md" />
      <Skeleton className="h-1/4 flex-1 rounded-t-md" />
    </div>
  );
}

export function ReportDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Skeleton className="h-4 w-24" />

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Skeleton className="size-12 rounded-xl" />
        <div>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-1.5 h-4 w-36" />
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card className="p-6">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="mt-4 h-16 w-full" />
            <Skeleton className="mt-4 h-48 w-full rounded-xl" />
          </Card>
          <Card className="p-6">
            <Skeleton className="h-5 w-48" />
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <Skeleton className="h-5 w-32" />
            <div className="mt-4 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </Card>
          <Card className="p-5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-4 h-10 w-full" />
          </Card>
        </div>
      </div>
    </div>
  );
}

export function TrackReportSkeleton() {
  return (
    <Card className="mt-5 space-y-5 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-xl" />
          <div>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="mt-1 h-3.5 w-20" />
          </div>
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="border-t border-slate-100 pt-4">
        <Skeleton className="h-4 w-48" />
      </div>
    </Card>
  );
}
