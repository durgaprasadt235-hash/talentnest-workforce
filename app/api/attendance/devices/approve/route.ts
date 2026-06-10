import { approveDevice } from "@/src/lib/attendance/service"
import { createDeviceRequestSchema } from "@/src/lib/attendance/validation"
import { errorResponse, parseJsonBody } from "@/src/lib/http"

export async function POST(request: Request) {
  try {
    const input = await parseJsonBody(request, createDeviceRequestSchema)
    return Response.json({ device: await approveDevice(input) })
  } catch (error) {
    return errorResponse(error)
  }
}
