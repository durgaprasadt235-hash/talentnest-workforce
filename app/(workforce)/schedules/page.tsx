import type { Metadata } from "next"
import { ScheduleManagement } from "@/components/schedules/schedule-management"
import { PermissionGuard } from "@/components/rbac/permission-guard"
import { FeatureLock } from "@/components/features/feature-lock"
import { Permission } from "@/src/lib/rbac/permissions"
import { FeatureKey } from "@/src/lib/features/feature-keys"

export const metadata: Metadata = { title: "Schedules" }
export default function Page() {
  return <PermissionGuard permission={Permission.VIEW_SCHEDULES}><FeatureLock feature={FeatureKey.SCHEDULING}><ScheduleManagement /></FeatureLock></PermissionGuard>
}
