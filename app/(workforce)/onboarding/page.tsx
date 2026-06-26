import type { Metadata } from "next"
import { OrganizationList } from "@/components/master-data/organization-list"
import { PermissionGuard } from "@/components/rbac/permission-guard"
import { Permission } from "@/src/lib/rbac/permissions"
export const metadata: Metadata = { title: "Onboarding" }
export default function Page() {
  return <PermissionGuard permission={Permission.VIEW_ORGANIZATION}><OrganizationList /></PermissionGuard>
}
