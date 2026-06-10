import { requestDevice } from "@/src/lib/attendance/service"
import { deviceRequestSchema } from "@/src/lib/attendance/validation"
import { errorResponse, parseJsonBody } from "@/src/lib/http"

export async function POST(request: Request) {
  try {
    const input = await parseJsonBody(request, deviceRequestSchema)
    return Response.json({ device: await requestDevice(input) })
  } catch (error) {
    return errorResponse(error)
  }
}
