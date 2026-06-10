import { approveDevice } from "@/src/lib/attendance/service"
import { approveDeviceRequestSchema } from "@/src/lib/attendance/validation"
import { errorResponse } from "@/src/lib/http"

export async function POST(request: Request) {
  try {
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
