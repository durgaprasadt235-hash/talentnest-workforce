import { rejectDevice } from "@/src/lib/attendance/service"
import { errorResponse } from "@/src/lib/http"

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (typeof body.deviceId !== "string" || !body.deviceId.trim()) {
      throw new Error("Device ID is required.")
    }

    return Response.json({ device: await rejectDevice(body.deviceId) })
  } catch (error) {
    return errorResponse(error)
  }
}
