import { listDevices, listDeviceOptions } from "@/src/lib/attendance/service"
import { errorResponse } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireClerkPermission } from "@/src/lib/rbac/server-guard"

export async function GET() {
  try {
    const user = await requireClerkPermission(Permission.VIEW_DEVICES)
    const [devices, options] = await Promise.all([
      listDevices(user),
      listDeviceOptions(user),
    ])
    return Response.json({ devices, ...options })
  } catch (error) {
    return errorResponse(error, 500)
  }
}
