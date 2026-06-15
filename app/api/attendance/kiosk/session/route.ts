import { createKioskSession } from "@/src/lib/attendance/service"
import { kioskSessionSchema } from "@/src/lib/attendance/validation"
import { errorResponse, parseJsonBody } from "@/src/lib/http"

export async function POST(request: Request) {
  try {
    return Response.json(
      await createKioskSession(await parseJsonBody(request, kioskSessionSchema)),
    )
  } catch (error) {
    return errorResponse(error)
  }
}
