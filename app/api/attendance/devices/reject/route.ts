import { rejectDevice } from "@/src/lib/attendance/service"
import { errorResponse } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function POST(request: Request) {
  try {
    await requireServerPermission(request, Permission.MANAGE_PROPERTIES)
    const body = await request.json()

    if (typeof body.deviceId !== "string" || !body.deviceId.trim()) {
      throw new Error("Device ID is required.")
    }

    return Response.json({ device: await rejectDevice(body.deviceId) })
  } catch (error) {
    return errorResponse(error)
  }
}
