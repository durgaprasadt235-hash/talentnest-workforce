import type { Metadata } from "next"

import { InvoiceManagement } from "@/components/invoices/invoice-management"
import { PermissionGuard } from "@/components/rbac/permission-guard"
import { Permission } from "@/src/lib/rbac/permissions"
import { FeatureLock, FeatureKey } from "@/components/features/feature-lock"

export const metadata: Metadata = { title: "Invoices" }

export default function Page() {
  return (
    <PermissionGuard permission={Permission.VIEW_INVOICES}>
      <FeatureLock feature={FeatureKey.INVOICES}><InvoiceManagement /></FeatureLock>
    </PermissionGuard>
  )
}
