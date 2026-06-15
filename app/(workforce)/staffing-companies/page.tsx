import type { Metadata } from "next"
import { StaffingCompanyManagement } from "@/components/staffing/staffing-company-management"
import { PermissionGuard } from "@/components/rbac/permission-guard"
import { Permission } from "@/src/lib/rbac/permissions"
import { FeatureKey } from "@/src/lib/features/feature-keys"
import { FeatureLock } from "@/components/features/feature-lock"

export const metadata: Metadata = { title: "Staffing Companies" }
export default function Page() {
  return <PermissionGuard permission={Permission.VIEW_STAFFING_COMPANIES}><FeatureLock feature={FeatureKey.STAFFING}><StaffingCompanyManagement /></FeatureLock></PermissionGuard>
}
