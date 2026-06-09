import type { Metadata } from "next"

import { PropertyList } from "@/components/master-data/property-list"
import { PermissionGuard } from "@/components/rbac/permission-guard"
import { Permission } from "@/src/lib/rbac/permissions"

export const metadata: Metadata = { title: "Properties" }

export default function Page() {
  return (
    <PermissionGuard permission={Permission.VIEW_PROPERTIES}>
      <PropertyList />
    </PermissionGuard>
  )
}
