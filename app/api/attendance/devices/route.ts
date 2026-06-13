import { listDevices, listDeviceOptions } from "@/src/lib/attendance/service"
import { errorResponse } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function GET(request: Request) {
  try {
    await requireServerPermission(request, Permission.MANAGE_PROPERTIES)
    const [devices, options] = await Promise.all([
      listDevices(),
      listDeviceOptions(),
    ])
    return Response.json({ devices, ...options })
  } catch (error) {
    return errorResponse(error, 500)
  }
}
