import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

export function Table({
  className,
  containerClassName,
  ...props
}: ComponentProps<"table"> & { containerClassName?: string }) {
  return (
    <div className={cn("w-full overflow-x-auto", containerClassName)}>
      <table className={cn("w-full text-left text-sm", className)} {...props} />
    </div>
  )
}

export function TableHead({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cn("border-b bg-muted/50 px-4 py-3 font-semibold", className)}
      {...props}
    />
  )
}

export function TableCell({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("border-b px-4 py-3", className)} {...props} />
}
