import { activateDevice } from "@/src/lib/attendance/service"
import { deviceRegistrationRequestSchema } from "@/src/lib/attendance/validation"
import { errorResponse, parseJsonBody } from "@/src/lib/http"

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, deviceRegistrationRequestSchema)
    const device = await activateDevice(body.registrationToken, body.fingerprint)
    return Response.json({ device })
  } catch (error) {
    return errorResponse(error)
  }
}
