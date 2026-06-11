import {
  AttendanceCorrectionNotFoundError,
  resolveAttendanceCorrection,
} from "@/src/lib/attendance/service"
import { correctionActionRequestSchema } from "@/src/lib/attendance/validation"
import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function POST(request: Request) {
  try {
    requireServerPermission(request, Permission.APPROVE_ATTENDANCE)
    const input = await parseJsonBody(request, correctionActionRequestSchema)

    return Response.json({
      correction: await resolveAttendanceCorrection(input),
    })
  } catch (error) {
    if (error instanceof AttendanceCorrectionNotFoundError) {
      return errorResponse(error, 404)
    }

    return errorResponse(error)
  }
}
