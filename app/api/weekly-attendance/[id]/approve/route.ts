import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { approveWeeklyAttendance } from "@/src/lib/weekly-attendance/service"
import { approveWeeklyAttendanceSchema } from "@/src/lib/weekly-attendance/validation"

export async function POST(
  request: Request,
  context: RouteContext<"/api/weekly-attendance/[id]/approve">,
) {
  try {
    requireServerPermission(request, Permission.APPROVE_WEEKLY_ATTENDANCE)
    const { id } = await context.params
    const input = await parseJsonBody(request, approveWeeklyAttendanceSchema)
    return Response.json({ batch: await approveWeeklyAttendance(id, input) })
  } catch (error) {
    return errorResponse(error)
  }
}
