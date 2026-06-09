import type { Metadata } from "next"
import { ResourcePage } from "@/components/shared/resource-page"
import { pageConfig } from "@/lib/page-config"
import { Permission } from "@/src/lib/rbac/permissions"

export const metadata: Metadata = { title: "Properties" }
export default function Page() {
  return <ResourcePage title={pageConfig.properties} requiredPermission={Permission.VIEW_PROPERTIES} />
}
