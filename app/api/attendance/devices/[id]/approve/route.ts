import { approveDevice } from "@/src/lib/attendance/service"
import { approveDeviceRequestSchema } from "@/src/lib/attendance/validation"
import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function POST(
  request: Request,
  context: RouteContext<"/api/attendance/devices/[id]/approve">,
) {
  try {
    requireServerPermission(request, Permission.MANAGE_PROPERTIES)
    const { id } = await context.params
    const input = await parseJsonBody(request, approveDeviceRequestSchema)
    return Response.json({ device: await approveDevice(id, input) })
  } catch (error) {
    return errorResponse(error)
  }
}
