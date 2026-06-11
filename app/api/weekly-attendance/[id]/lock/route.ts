import { errorResponse } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { lockWeeklyAttendance } from "@/src/lib/weekly-attendance/service"
import { assertPropertyManagerBatchScope } from "@/src/lib/weekly-attendance/workflow-service"

export async function POST(
  request: Request,
  context: RouteContext<"/api/weekly-attendance/[id]/lock">,
) {
  try {
    const user = requireServerPermission(request, Permission.LOCK_WEEKLY_ATTENDANCE)
    const { id } = await context.params
    await assertPropertyManagerBatchScope(id, user)
    return Response.json({ batch: await lockWeeklyAttendance(id) })
  } catch (error) {
    return errorResponse(error)
  }
}
