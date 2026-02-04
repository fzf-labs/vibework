export function EmptyState() {
  return (
    <div className="rounded-lg border bg-card px-6 py-10 text-center shadow-sm">
      <h2 className="text-lg font-semibold">还没有任务</h2>
      <p className="text-muted-foreground mt-2 text-sm">
        创建任务后，这里会显示最新的任务动态和概览指标。
      </p>
    </div>
  )
}
