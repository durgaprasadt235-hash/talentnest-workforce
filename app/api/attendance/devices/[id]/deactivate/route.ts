import { deactivateDevice } from "@/src/lib/attendance/service"
import { errorResponse } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireClerkPermission } from "@/src/lib/rbac/server-guard"

export async function PATCH(
  _request: Request,
  context: RouteContext<"/api/attendance/devices/[id]/deactivate">,
) {
  try {
    const user = await requireClerkPermission(Permission.MANAGE_DEVICES)
    const { id } = await context.params
    return Response.json({ device: await deactivateDevice(id, user) })
  } catch (error) {
    return errorResponse(error)
  }
}
