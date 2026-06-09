import { createDevice, listDevices, listDeviceOptions } from "@/src/lib/attendance/service"
import type { CreateDeviceRequest } from "@/src/lib/attendance/types"
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

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as CreateDeviceRequest
    return Response.json({ device: await createDevice(input) }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
