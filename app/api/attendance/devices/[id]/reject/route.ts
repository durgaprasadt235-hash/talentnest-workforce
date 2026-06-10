import { rejectDevice } from "@/src/lib/attendance/service"
import { errorResponse } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function POST(
  _request: Request,
  context: RouteContext<"/api/attendance/devices/[id]/reject">,
) {
  try {
    requireServerPermission(_request, Permission.MANAGE_PROPERTIES)
    const { id } = await context.params
    return Response.json({ device: await rejectDevice(id) })
  } catch (error) {
    return errorResponse(error)
  }
}
