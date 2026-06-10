import { rejectDevice } from "@/src/lib/attendance/service"
import { errorResponse } from "@/src/lib/http"

export async function POST(
  _request: Request,
  context: RouteContext<"/api/attendance/devices/[id]/reject">,
) {
  try {
    const { id } = await context.params
    return Response.json({ device: await rejectDevice(id) })
  } catch (error) {
    return errorResponse(error)
  }
}
