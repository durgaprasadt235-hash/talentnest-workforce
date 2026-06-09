import { errorResponse } from "@/src/lib/http"
import { listProperties } from "@/src/lib/master-data/service"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function GET(request: Request) {
  try {
    requireServerPermission(request, Permission.VIEW_PROPERTIES)
    return Response.json({ properties: await listProperties() })
  } catch (error) {
    return errorResponse(error, 500)
  }
}
