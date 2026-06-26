import { Suspense } from "react"
import type { Metadata } from "next"
import { UserAccessManagement } from "@/components/users/user-access-management"
export const metadata: Metadata = { title: "Internal Teams" }
export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading users...</div>}>
      <UserAccessManagement />
    </Suspense>
  )
}
