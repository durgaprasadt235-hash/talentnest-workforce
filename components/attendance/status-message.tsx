import { cn } from "@/lib/utils"

export function StatusMessage({
  message,
  error = false,
}: {
  message?: string
  error?: boolean
}) {
  if (!message) return null

  return (
    <div
      role="status"
      className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        error
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-primary/20 bg-primary/5 text-foreground",
      )}
    >
      {message}
    </div>
  )
}
