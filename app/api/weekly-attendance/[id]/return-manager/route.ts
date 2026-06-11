import { errorResponse } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { returnWeeklyAttendanceToManager } from "@/src/lib/weekly-attendance/workflow-service"

type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: Context) {
  try {
    const user = requireServerPermission(request, Permission.MANAGE_CORPORATE_WEEKLY_ATTENDANCE)
    const { id } = await context.params
    return Response.json({ batch: await returnWeeklyAttendanceToManager(id, user) })
  } catch (error) {
    return errorResponse(error)
  }
}
