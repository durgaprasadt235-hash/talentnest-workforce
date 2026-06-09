import { checkMissedClockOuts } from "@/src/lib/attendance/service"
import { errorResponse } from "@/src/lib/http"

export async function POST() {
  try {
    return Response.json(await checkMissedClockOuts())
  } catch (error) {
    return errorResponse(error, 500)
  }
}
