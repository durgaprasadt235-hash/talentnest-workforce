import type { Metadata } from "next"

import { EmployeeManagement } from "@/components/employees/employee-management"
import { PermissionGuard } from "@/components/rbac/permission-guard"
import { Permission } from "@/src/lib/rbac/permissions"

export const metadata: Metadata = { title: "Employees" }

export default function Page() {
  return (
    <PermissionGuard permission={Permission.VIEW_EMPLOYEES}>
      <EmployeeManagement />
    </PermissionGuard>
  )
}
