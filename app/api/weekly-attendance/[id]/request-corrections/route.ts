import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { requestWeeklyAttendanceCorrections } from "@/src/lib/weekly-attendance/service"
import { requestWeeklyAttendanceCorrectionsSchema } from "@/src/lib/weekly-attendance/validation"
import { assertPropertyManagerBatchScope } from "@/src/lib/weekly-attendance/workflow-service"

export async function POST(
  request: Request,
  context: RouteContext<"/api/weekly-attendance/[id]/request-corrections">,
) {
  try {
    const user = await requireServerPermission(request, Permission.APPROVE_WEEKLY_ATTENDANCE)
    const { id } = await context.params
    await assertPropertyManagerBatchScope(id, user)
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
