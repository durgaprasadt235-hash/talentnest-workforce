import { activateDevice } from "@/src/lib/attendance/service"
import { errorResponse } from "@/src/lib/http"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      registrationToken: string
      fingerprint: Record<string, unknown>
    }
    const device = await activateDevice(body.registrationToken, body.fingerprint)
    return Response.json({ device })
  } catch (error) {
    return errorResponse(error)
  }
}
