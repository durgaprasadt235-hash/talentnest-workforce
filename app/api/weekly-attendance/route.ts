import { errorResponse } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { listWeeklyAttendance } from "@/src/lib/weekly-attendance/service"

export async function GET(request: Request) {
  try {
    const user = requireServerPermission(request, Permission.VIEW_WEEKLY_ATTENDANCE)
    return Response.json(await listWeeklyAttendance(user.role))
  } catch (error) {
    return errorResponse(error, 500)
  }
}
