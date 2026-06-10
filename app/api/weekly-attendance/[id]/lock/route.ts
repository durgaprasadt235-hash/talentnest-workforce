import { errorResponse } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { lockWeeklyAttendance } from "@/src/lib/weekly-attendance/service"

export async function POST(
  request: Request,
  context: RouteContext<"/api/weekly-attendance/[id]/lock">,
) {
  try {
    requireServerPermission(request, Permission.LOCK_WEEKLY_ATTENDANCE)
    const { id } = await context.params
    return Response.json({ batch: await lockWeeklyAttendance(id) })
  } catch (error) {
    return errorResponse(error)
  }
}
