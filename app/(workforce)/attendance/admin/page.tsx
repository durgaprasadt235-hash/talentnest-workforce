import type { Metadata } from "next"

import { AttendanceAdmin } from "@/components/attendance/attendance-admin"
import { PermissionGuard } from "@/components/rbac/permission-guard"
import { Permission } from "@/src/lib/rbac/permissions"

export const metadata: Metadata = { title: "Attendance Admin" }

export default function Page() {
  return <PermissionGuard permission={Permission.APPROVE_ATTENDANCE}><AttendanceAdmin /></PermissionGuard>
}
