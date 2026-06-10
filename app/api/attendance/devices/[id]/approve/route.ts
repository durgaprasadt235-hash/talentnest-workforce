import { approveDevice } from "@/src/lib/attendance/service"
import { approveDeviceRequestSchema } from "@/src/lib/attendance/validation"
import { errorResponse, parseJsonBody } from "@/src/lib/http"

export async function POST(
  request: Request,
  context: RouteContext<"/api/attendance/devices/[id]/approve">,
) {
  try {
    const { id } = await context.params
    const input = await parseJsonBody(request, approveDeviceRequestSchema)
    return Response.json({ device: await approveDevice(id, input) })
  } catch (error) {
    return errorResponse(error)
  }
}
