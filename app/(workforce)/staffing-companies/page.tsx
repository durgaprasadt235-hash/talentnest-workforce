import type { Metadata } from "next"
import { ResourcePage } from "@/components/shared/resource-page"
import { pageConfig } from "@/lib/page-config"
import { Permission } from "@/src/lib/rbac/permissions"

export const metadata: Metadata = { title: "Staffing Companies" }
export default function Page() {
  return <ResourcePage title={pageConfig["staffing-companies"]} requiredPermission={Permission.VIEW_STAFFING_COMPANIES} />
}
