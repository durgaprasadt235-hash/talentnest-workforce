import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { approveWeeklyAttendance } from "@/src/lib/weekly-attendance/service"
import { approveWeeklyAttendanceSchema } from "@/src/lib/weekly-attendance/validation"
import { assertPropertyManagerBatchScope } from "@/src/lib/weekly-attendance/workflow-service"

export async function POST(
  request: Request,
  context: RouteContext<"/api/weekly-attendance/[id]/approve">,
) {
  try {
    const user = requireServerPermission(request, Permission.APPROVE_WEEKLY_ATTENDANCE)
    const { id } = await context.params
    await assertPropertyManagerBatchScope(id, user)
    const input = await parseJsonBody(request, approveWeeklyAttendanceSchema)
    return Response.json({ batch: await approveWeeklyAttendance(id, input) })
  } catch (error) {
    return errorResponse(error)
  }
}
