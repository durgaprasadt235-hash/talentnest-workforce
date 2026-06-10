import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { requestWeeklyAttendanceCorrections } from "@/src/lib/weekly-attendance/service"
import { requestWeeklyAttendanceCorrectionsSchema } from "@/src/lib/weekly-attendance/validation"

export async function POST(
  request: Request,
  context: RouteContext<"/api/weekly-attendance/[id]/request-corrections">,
) {
  try {
    requireServerPermission(request, Permission.APPROVE_WEEKLY_ATTENDANCE)
    const { id } = await context.params
    const input = await parseJsonBody(
      request,
      requestWeeklyAttendanceCorrectionsSchema,
    )
    return Response.json({
      batch: await requestWeeklyAttendanceCorrections(id, input),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
