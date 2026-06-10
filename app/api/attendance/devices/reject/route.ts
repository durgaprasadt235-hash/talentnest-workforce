import { rejectDevice } from "@/src/lib/attendance/service"
import { rejectDeviceRequestSchema } from "@/src/lib/attendance/validation"
import { errorResponse, parseJsonBody } from "@/src/lib/http"

export async function POST(request: Request) {
  try {
    const { deviceId } = await parseJsonBody(request, rejectDeviceRequestSchema)
    return Response.json({ device: await rejectDevice(deviceId) })
  } catch (error) {
    return errorResponse(error)
  }
}
