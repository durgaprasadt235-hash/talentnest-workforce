import { errorResponse } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { getWeeklyAttendanceBatchByRole } from "@/src/lib/weekly-attendance/role-service"

export async function GET(
  request: Request,
  context: RouteContext<"/api/weekly-attendance/[id]">,
) {
  try {
    const user = requireServerPermission(request, Permission.VIEW_WEEKLY_ATTENDANCE)
    const { id } = await context.params
    return Response.json({
      batch: await getWeeklyAttendanceBatchByRole(id, user),
    })
  } catch (error) {
    return errorResponse(error, 500)
  }
}
