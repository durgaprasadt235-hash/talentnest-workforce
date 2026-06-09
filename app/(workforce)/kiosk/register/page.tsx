import type { Metadata } from "next"

import { KioskRegistration } from "@/components/attendance/kiosk-registration"
import { PermissionGuard } from "@/components/rbac/permission-guard"
import { Permission } from "@/src/lib/rbac/permissions"

export const metadata: Metadata = { title: "Register Attendance Kiosk" }

export default function Page() {
  return <PermissionGuard permission={Permission.MANAGE_PROPERTIES}><KioskRegistration /></PermissionGuard>
}
