import { errorResponse } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { sendWeeklyAttendanceToFinance } from "@/src/lib/weekly-attendance/workflow-service"

type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireServerPermission(request, Permission.SEND_WEEKLY_ATTENDANCE_TO_FINANCE)
    const { id } = await context.params
    return Response.json({ batch: await sendWeeklyAttendanceToFinance(id, user) })
  } catch (error) {
    return errorResponse(error)
  }
}
