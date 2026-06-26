import { Suspense } from "react"
import type { Metadata } from "next"
import { UserAccessManagement } from "@/components/users/user-access-management"

export const metadata: Metadata = { title: "Users & Access" }
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string; role?: string; create?: string }>
}) {
  const query = await searchParams
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading users...</div>}>
      <UserAccessManagement
        initialOrganizationId={query.organizationId}
        initialRole={query.role}
        initialCreate={query.create === "1"}
      />
    </Suspense>
  )
}
