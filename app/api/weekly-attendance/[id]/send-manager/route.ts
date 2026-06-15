import { errorResponse } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { sendWeeklyAttendanceToManager } from "@/src/lib/weekly-attendance/workflow-service"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireServerPermission(request, Permission.GENERATE_WEEKLY_ATTENDANCE)
    const { id } = await context.params
    return Response.json({ batch: await sendWeeklyAttendanceToManager(id, user) })
  } catch (error) {
    return errorResponse(error)
  }
}
