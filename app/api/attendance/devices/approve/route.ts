import { approveDevice } from "@/src/lib/attendance/service"
import { approveDeviceRequestSchema } from "@/src/lib/attendance/validation"
import { errorResponse } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function POST(request: Request) {
  try {
    await requireServerPermission(request, Permission.MANAGE_PROPERTIES)
    const body = await request.json()
    const input = approveDeviceRequestSchema.parse(body)

    if (typeof body.deviceId !== "string" || !body.deviceId.trim()) {
      throw new Error("Device ID is required.")
    }

    return Response.json({ device: await approveDevice(body.deviceId, input) })
  } catch (error) {
    return errorResponse(error)
  }
}
