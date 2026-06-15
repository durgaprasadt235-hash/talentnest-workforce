import type { Metadata } from "next"

import { DepartmentList } from "@/components/master-data/department-list"
import { DepartmentRoleManagement } from "@/components/master-data/department-role-management"
import { PermissionGuard } from "@/components/rbac/permission-guard"
import { Permission } from "@/src/lib/rbac/permissions"

export const metadata: Metadata = { title: "Departments" }

export default function Page() {
  return (
    <PermissionGuard permission={Permission.VIEW_DEPARTMENTS}>
      <div className="space-y-6"><DepartmentList /><DepartmentRoleManagement /></div>
    </PermissionGuard>
  )
}
