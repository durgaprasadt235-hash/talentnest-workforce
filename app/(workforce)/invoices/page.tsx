import type { Metadata } from "next"

import { InvoiceManagement } from "@/components/invoices/invoice-management"
import { PermissionGuard } from "@/components/rbac/permission-guard"
import { Permission } from "@/src/lib/rbac/permissions"

export const metadata: Metadata = { title: "Invoices" }

export default function Page() {
  return (
    <PermissionGuard permission={Permission.VIEW_INVOICES}>
      <InvoiceManagement />
    </PermissionGuard>
  )
}
