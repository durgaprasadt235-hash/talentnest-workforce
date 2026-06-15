import type { Metadata } from "next"
import { UserAccessManagement } from "@/components/users/user-access-management"

export const metadata: Metadata = { title: "Users & Access" }
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string; role?: string }>
}) {
  const query = await searchParams
  return <UserAccessManagement initialOrganizationId={query.organizationId} initialRole={query.role} />
}
