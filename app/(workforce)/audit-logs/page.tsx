import type { Metadata } from "next"
import { ResourcePage } from "@/components/shared/resource-page"
import { pageConfig } from "@/lib/page-config"
import { Permission } from "@/src/lib/rbac/permissions"

export const metadata: Metadata = { title: "Audit Logs" }
export default function Page() {
  return <ResourcePage title={pageConfig["audit-logs"]} requiredPermission={Permission.VIEW_AUDIT_LOGS} />
}
