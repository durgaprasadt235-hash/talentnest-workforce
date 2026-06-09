import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

export function Badge({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground",
        className,
      )}
      {...props}
    />
  )
}
