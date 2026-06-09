import type { Metadata } from "next"

import { KioskClock } from "@/components/attendance/kiosk-clock"
import { PermissionGuard } from "@/components/rbac/permission-guard"
import { Permission } from "@/src/lib/rbac/permissions"

export const metadata: Metadata = { title: "Attendance Kiosk" }

export default function Page() {
  return <PermissionGuard permission={Permission.VIEW_ATTENDANCE}><KioskClock /></PermissionGuard>
}
