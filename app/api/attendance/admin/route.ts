import { getAttendanceAdminData } from "@/src/lib/attendance/service"
import { errorResponse } from "@/src/lib/http"

export async function GET() {
  try {
    return Response.json(await getAttendanceAdminData())
  } catch (error) {
    return errorResponse(error, 500)
  }
}
