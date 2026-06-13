import type { Metadata } from "next"

import { WeeklyAttendance } from "@/components/attendance/weekly-attendance"
import { PermissionGuard } from "@/components/rbac/permission-guard"
import { Permission } from "@/src/lib/rbac/permissions"
import { FeatureLock, FeatureKey } from "@/components/features/feature-lock"

export const metadata: Metadata = { title: "Weekly Attendance" }

export default function Page() {
  return (
    <PermissionGuard permission={Permission.VIEW_WEEKLY_ATTENDANCE}>
      <FeatureLock feature={FeatureKey.TIMESHEETS}><WeeklyAttendance /></FeatureLock>
    </PermissionGuard>
  )
}
