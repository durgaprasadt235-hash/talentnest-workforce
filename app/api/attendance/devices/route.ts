import { listDevices, listDeviceOptions } from "@/src/lib/attendance/service"
import { errorResponse } from "@/src/lib/http"

export async function GET() {
  try {
    const [devices, options] = await Promise.all([
      listDevices(),
      listDeviceOptions(),
    ])
    return Response.json({ devices, ...options })
  } catch (error) {
    return errorResponse(error, 500)
  }
}
