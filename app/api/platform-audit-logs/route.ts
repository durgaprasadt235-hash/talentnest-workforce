import { auditLogExportResponse, listPlatformAuditLogs, parseAuditLogQuery } from "@/src/lib/audit-logs/service"
import { errorResponse } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function GET(request: Request) {
  try {
    const user = await requireServerPermission(request, Permission.VIEW_AUDIT_LOGS)
    const url = new URL(request.url)
    const data = await listPlatformAuditLogs(user, parseAuditLogQuery(url))
    const format = url.searchParams.get("format")
    return format === "csv" || format === "excel"
      ? auditLogExportResponse(data.records, format)
      : Response.json(data)
  } catch (error) {
    return errorResponse(error, 500)
  }
}
