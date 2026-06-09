import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn("rounded-xl border bg-card text-card-foreground", className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: ComponentProps<"header">) {
  return <header className={cn("border-b p-5", className)} {...props} />
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />
}
