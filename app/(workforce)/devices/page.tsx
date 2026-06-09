import type { Metadata } from "next"

import { DeviceManagement } from "@/components/attendance/device-management"
import { PermissionGuard } from "@/components/rbac/permission-guard"
import { Permission } from "@/src/lib/rbac/permissions"

export const metadata: Metadata = { title: "Device Management" }

export default function Page() {
  return <PermissionGuard permission={Permission.MANAGE_PROPERTIES}><DeviceManagement /></PermissionGuard>
}
