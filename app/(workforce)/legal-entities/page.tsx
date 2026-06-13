import type { Metadata } from "next"

import { LegalEntityManagement } from "@/components/master-data/legal-entity-management"
import { PermissionGuard } from "@/components/rbac/permission-guard"
import { Permission } from "@/src/lib/rbac/permissions"

export const metadata: Metadata = { title: "Legal Entities" }

export default function Page() {
  return <PermissionGuard permission={Permission.VIEW_LEGAL_ENTITIES}><LegalEntityManagement /></PermissionGuard>
}
